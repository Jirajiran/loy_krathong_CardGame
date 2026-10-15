Asset/ — unified UI + art (menu, gameplay shell, cards, seats)

Local: Deploy/serve.bat junctions Deploy/Asset → this folder.
Netlify: build copies this folder into Deploy/Asset (see repo-root netlify.toml).

  Menu/                 MainMenu.svg, MainMenuBg.svg
  GamePlay/             GamePlaySVG.svg (primary gameplay shell)
  Card/
    Template/           SVGTemplate.svg + Template000n.png
    Art/                Card_0001.png … Card_0024.png
    Frame/              Template_Card.svg (blank print)
    Icon/, Token/, BackCard.png
  Seat/
    Character/          Character_Default.png
    BackGround/         BackGroup_Default_1.png

Deploy/Asset is a junction to this folder. Edit here; ship via Deploy/.
Legacy GamePlay.svg / ToxicBoard.svg removed — use GamePlaySVG only.
