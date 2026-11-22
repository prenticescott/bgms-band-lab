# BGMS Band Lab 1.1

A free, responsive practice recorder prototype for web, Chromebook, iPhone, and iPad.

## Included
- Ensemble and instrument selection
- Practice focus and exercise title
- Microphone recording, stop, playback preview, and save
- Local recording library with playback and delete
- Practice checklist
- Chromatic tuner with live pitch, frequency, and cents deviation (concert pitch)
- Responsive layout and installable PWA shell
- Offline app shell after first successful visit

## Important limitations
- Recordings and session details are stored in the browser on the device used. They do not sync between devices and clearing browser data may erase them.
- The tuner is a practice aid, not a graded assessment. Pitch detection can be affected by room noise, instrument harmonics, microphone quality, and very soft notes. It reports concert pitch; transposing-instrument written-pitch display is not included yet.
- This version does not grade rhythm, upload assignments, or provide student accounts.
- Microphone recording generally requires HTTPS or localhost. GitHub Pages provides HTTPS.
- Test with teacher-owned/sample recordings first. Obtain district approval before collecting student-identifiable information or recordings. Follow district policies and applicable student privacy requirements.

## Run locally
Use a local web server from this folder, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Do not open `index.html` directly as a file because microphone access and service workers need a secure context.

## Publish free with GitHub Pages
1. Create a GitHub account and a new public repository named `bgms-band-lab` (public repositories are required for GitHub Free Pages in the standard setup).
2. Upload the contents of this folder to the repository root.
3. In repository Settings → Pages, choose Deploy from a branch, select `main` and `/ (root)`, then Save.
4. Open the HTTPS Pages URL on a device and allow microphone access.
5. On iPhone/iPad, open the URL in Safari → Share → Add to Home Screen. On supported Android browsers, use the browser's Install option.

## Data and storage
Audio is stored as browser-local data. Avoid long recordings because browser storage limits vary by device. Delete unneeded takes from My recordings. This is a personal practice tool, not a secure student records system.
