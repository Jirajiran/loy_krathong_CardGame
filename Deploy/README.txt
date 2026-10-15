Deploy/ — static ship root (itch.io zip · Netlify · GitHub Pages)

Structure
  index.html          game entry (menu V2 · gameplay GamePlaySVG · card compose)
  print-cards.html    card print / pack export (full + blank)
  v3-gameplay.js      GamePlaySVG UI bind
  netlify.toml        Netlify publish = "."
  serve.bat           local HTTP via Python 3.12
  Audio/              BGM + SFX (ASCII names)
  Asset/              unified UI + art (junction → ../Asset)
    Menu/             MainMenu.svg, MainMenuBg.svg
    GamePlay/         GamePlaySVG.svg only
    Card/Template, Art, Frame, Icon, Token
    Seat/Character, BackGround

print-cards.html skins: full (SVGTemplate + Art) · เปล่า (Frame only)

Checklist
  [ ] Serve over HTTP — run serve.bat from this folder
  [ ] Paths relative — open from Deploy/ as site root
  [ ] No secrets in this folder
  [ ] Asset filenames ASCII only
  [ ] Credits in UI (x.com/nolawdJi)

itch.io: zip contents of Deploy/ so zip root has index.html
Netlify (recommended): Base directory empty, use repo-root netlify.toml
  → build copies Asset/ into Deploy/Asset, publish = Deploy
  Alt: Base directory = Deploy (uses Deploy/netlify.toml, copies ../Asset)
GitHub Pages: publish Deploy/ (with Asset copied/linked) or copy to docs/
