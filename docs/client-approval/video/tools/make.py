# Builds the timeline from the narration clips: video.html (with data), captions (.srt), narration track, music track.
# Everything is read from and written to D:.
import json, re, wave, subprocess, os
V = r"D:\sunshine\ai-calling-agent\docs\client-approval\video"
B = V + r"\build"
FF = r"D:\voxura-video-tools\py\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v9.0.2.exe"
LEAD, TAIL = 0.7, 1.1           # silence before / after each scene's narration
MIN = {"intro": 8.5, "outro": 7.5, "section": 4.0}

scenes = json.load(open(B + r"\scenes.json", encoding="utf-8"))
t = 0.0
for s in scenes:
    with wave.open(B + rf"\audio\{s['id']}.wav") as w:
        s["adur"] = w.getnframes() / w.getframerate(); rate = w.getframerate()
    lead = 2.6 if s["tpl"] == "intro" else LEAD
    s["lead"] = lead
    s["dur"] = round(max(MIN.get(s["tpl"], 0), lead + s["adur"] + TAIL), 2)
    s["start"] = round(t, 2); t += s["dur"]
    # captions: sentence chunks (long ones split at commas), timed by length across the spoken part
    parts = []
    for sent in re.split(r"(?<=[.?!])\s+", s["narr"].strip()):
        if len(sent) > 78 and "," in sent:
            bits, cur = [], ""
            for b in re.split(r"(?<=,)\s+", sent):
                if cur and len(cur) + len(b) > 70: bits.append(cur); cur = b
                else: cur = (cur + " " + b).strip()
            bits.append(cur); parts += bits
        else: parts.append(sent)
    total = sum(len(p) for p in parts); a = lead; s["caps"] = []
    for p in parts:
        d = s["adur"] * len(p) / total
        s["caps"].append({"a": round(a, 2), "b": round(a + d, 2), "text": p}); a += d
TOTAL = round(t, 2)

data = {"total": TOTAL, "scenes": [{k: v for k, v in s.items() if k != "narr"} for s in scenes]}
tpl = open(V + r"\tools\video.tpl.html", encoding="utf-8").read()
open(B + r"\video.html", "w", encoding="utf-8").write(tpl.replace("/*DATA*/null", json.dumps(data, ensure_ascii=False)))

def ts(x):
    ms = int(round(x * 1000)); return f"{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}"
with open(V + r"\Voxura-Walkthrough.srt", "w", encoding="utf-8") as f:
    n = 1
    for s in scenes:
        for c in s["caps"]:
            f.write(f"{n}\n{ts(s['start']+c['a'])} --> {ts(s['start']+c['b'])}\n{c['text']}\n\n"); n += 1

# narration track: each clip placed at scene start + lead
with wave.open(B + r"\narration.wav", "wb") as out:
    out.setnchannels(1); out.setsampwidth(2); out.setframerate(rate)
    pos = 0
    for s in scenes:
        at = int((s["start"] + s["lead"]) * rate)
        out.writeframes(b"\x00\x00" * (at - pos)); pos = at
        with wave.open(B + rf"\audio\{s['id']}.wav") as w:
            fr = w.readframes(w.getnframes()); out.writeframes(fr); pos += w.getnframes()
    out.writeframes(b"\x00\x00" * (int(TOTAL * rate) - pos))

# music: slow, soft four-chord pad (Am9 · Fmaj7 · Cmaj7 · G6), 8 s per chord with cross-fades
chords = [[110, 164.81, 196, 246.94, 261.63], [87.31, 130.81, 164.81, 220, 261.63], [130.81, 196, 246.94, 329.63], [98, 146.83, 246.94, 329.63, 293.66]]
terms = []
for k, ch in enumerate(chords):
    w = f"clip((mod(t,32)-{8*k}+1.5)/3,0,1)*clip(({8*k+9.5}-mod(t,32))/3,0,1)"
    if k == 0: w = f"max({w},clip((mod(t,32)-30.5)/3,0,1))"
    notes = "+".join(f"sin(2*PI*{f}*t)+0.35*sin(2*PI*{f*1.004:.3f}*t)" for f in ch)
    terms.append(f"{w}*({notes})")
expr = "0.018*(" + "+".join(terms) + ")*(0.85+0.15*sin(2*PI*0.07*t))"
# soft chime at the start of each section / setup / daily scene change
chime_at = [s["start"] + 0.15 for s in scenes if s["tpl"] in ("section", "six", "twoflows", "stats", "outro")]
chime = "+".join(f"if(between(t,{a:.2f},{a+2.5:.2f}),exp(-2.2*(t-{a:.2f}))*(sin(2*PI*880*(t-{a:.2f}))+0.5*sin(2*PI*1318.5*(t-{a:.2f}))),0)" for a in chime_at)
open(B + r"\music_expr.txt", "w").write(f"{expr}+0.05*({chime})")
subprocess.run([FF, "-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
    f"aevalsrc=exprs='{expr}+0.05*({chime})':s=44100:d={TOTAL}",
    "-af", f"lowpass=f=2200,aecho=0.8:0.6:90|170:0.25|0.15,afade=t=in:d=3,afade=t=out:st={TOTAL-4}:d=4",
    B + r"\music.wav"], check=True)

# final audio: narration up front, music ducked under the voice
subprocess.run([FF, "-y", "-hide_banner", "-loglevel", "error", "-i", B + r"\narration.wav", "-i", B + r"\music.wav", "-filter_complex",
    "[0:a]aresample=44100,highpass=f=70,acompressor=threshold=-18dB:ratio=3:makeup=3,volume=1.0,asplit=2[v][sc];"
    "[1:a]volume=0.55[m];[m][sc]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=600[md];"
    "[v][md]amix=inputs=2:normalize=0,alimiter=limit=0.95[out]",
    "-map", "[out]", "-c:a", "aac", "-b:a", "192k", B + r"\audio-mix.m4a"], check=True)
print(f"scenes {len(scenes)}  total {TOTAL:.1f}s ({int(TOTAL//60)}m{int(TOTAL%60):02}s)")
