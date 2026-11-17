# How to record a video from Stadium Studio

Every video comes out as a vertical **1080 × 1920, 30 fps MP4**, ready for TikTok, Reels and Shorts.
Only the 3D picture, plus the design layer if you pick one, is recorded. Panels and the style labels never appear in the video.

## Before you start

- Use **Google Chrome**. Safari and Firefox may not be able to save MP4.
- Open the page from your Mac, not from the claude.ai link. The claude.ai page blocks downloads, so nothing would save.
  - In Finder, go to **Visual Design Project > stadium-studio**, right-click **index.html**, choose **Open With > Google Chrome**.
- Videos save to your **Downloads** folder, named like `msg-night-orbit180-20261115-231742.mp4` (venue, style, move, date and time).

## 1. Open the recorder

1. Click **Record** (top bar, next to Reset view). The recorder panel opens and the picture shrinks to a tall 9:16 frame.
2. TikTok, Reels and Shorts cover the top 8%, the bottom 20% and a strip on the right with their buttons. Keep the important part of the shot in the middle.
3. Optional: click **Hide panels** to clear the title and style cards off the picture while you frame the shot.
4. Optional: pick a **Design layer** (for example **Facts**, **Underneath**, **Field** or **4 train**). Outlines, measurements, labels and glowing train lines appear on the picture and draw themselves on. They are recorded too, and they draw on again at the start of every clip. Pick **Off** for a clean picture.

## 2a. Planned move (smooth, recommended for final videos)

The engine builds the video one frame at a time, so it is perfectly smooth even if your Mac is slow.

1. Pick a style at the bottom, then drag and zoom to frame your first view.
2. Click **Set start**.
3. For a glide: move the camera to the end view, click **Set end**, and leave **Move** on **Start to end**.
   For a turn: choose an **Orbit** in **Move**. Orbits turn around the spot the camera is looking at. **Orbit 360° (loops)** makes a video that repeats without a jump.
4. Pick a **Length** (4 to 15 seconds).
5. Click **Preview** to watch the move. Nothing is saved.
6. Click **Render MP4**. A bar shows progress. A 4-second clip takes about 15 to 30 seconds.

## 2b. Live take (quick, records what you do)

1. Click **● Start recording**. A red outline means it is recording.
2. Drag, zoom, or click other styles. Style changes glide on camera, which makes a nice transition.
3. Click **■ Stop and save**.

Live takes can stutter when the scene is heavy (Night game, Daylight aerial with the whole city). Use a planned move when it has to be smooth.

## Good to know

- **Blueprint sheet** is a still drawing, so it can't be recorded.
- Switching venue clears your saved start and end views.
- Start and end must use the same camera type. The flat Iso styles and Cutaway use a different camera from the others.
- The trains under MSG and Yankee Stadium keep running in the video, on the same clock as the page.
- **Block cutout** (MSG only for now) lifts the Garden's block out of the city onto a dark stage. Pair it with the **Block outline** design layer for the glowing box and red arrows. It works in all three eras.
- **Shadow clock** moves the real sun from sunrise to sunset in about 9 seconds. Today uses Dec 21 (the shortest day); 1910 uses opening day. Record at least 10 seconds to catch the whole day.
- **Weather** shows a real NOAA day. Rain or snow only appears if that day had it. In the 1910 era, **Weather · 1963** is the day demolition began (rain). Today's card is the Garden's opening night in 1968.

## Beginner mistakes to avoid

- **Recording from the claude.ai link.** Downloads are blocked there. Use the copy on your Mac.
- **Important stuff at the very bottom or right edge.** The app's buttons will cover it once you post.
- **Long live takes.** Several short clips are easier to edit in CapCut than one long one.
- **Captions in the design layer.** The layer has no caption words on purpose. Add captions in CapCut, where they sync to your voice and stay editable.

## 3. Whole episodes, rendered for you (episode renderer)

Claude can now build a full episode in one go: every shot, photos, Google Earth clips, big captions and a scratch voice, cut to the voice and saved as one MP4. No editing app needed for the rough cut.

- **The recipe:** each episode has a `cut.js` in its folder (for example `videos/01-msg-penn-station/cut.js`). It lists the voice lines, then the shots in order (view, era, design layer, camera move) and the caption words.
- **The voice:** one file per line in the episode's `voice` folder. The rough cut uses the Mac's built-in voice so the timing is right. To use a better AI voice, replace those files with the same names and ask Claude to re-render; the shots move to fit.
- **Where files land:** the full cut goes in the episode's `export` folder; single shots go in `clips`.
- **Google Earth clips:** render them in Earth Studio (Video .mp4, 1080 × 1920), download them yourself (the download needs your click), and drop them in `clips` named as the recipe expects (`G1-zoom-to-msg.mp4`, `G2-grand-central.mp4`). Until then the cut uses stand-ins.
- **To render:** ask Claude ("re-render episode 1"). It runs the studio in its own browser, so your Mac only needs the project folder.

## 4. The MSG studio (msg.html)

`stadium-studio/msg.html` is the same studio with only Madison Square Garden loaded, so it opens and renders faster. Yankee Stadium still lives in `index.html`.

- **The wider city:** about 4,000 more buildings from river to river (23rd to 42nd Street), from the city's building footprints (`data/fetch_skyline.py`). In the 1910 era, buildings newer than 1910 stand in as typical walk-ups on the same lots (an approximation).
- **City section** (new view): the neighborhood cut open along the tracks, with the Garden's bowl sliced above the station and the rock layers below.
- **Trains out** (design layer): the rail lines as moving dashes, carried past the model toward the Hudson and East River tunnels. Past the model area the lines run straight along the street grid; their real curves aren't in our data.
- **Build-up** (design layer): timed labels for the build-up sequence; the episode renderer drops each part of the Garden into place to match.
- **Captions** sit on a solid cyan block, and design-layer labels sit on dark plates, so text reads over the bright model. The display font is Big Shoulders.
