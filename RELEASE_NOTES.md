Jelly+ 0.1.7.0 – Zeitliche Abgrenzung saisonaler Empfehlungen.

- Bereits angezeigte Saisonempfehlungen werden etwa jede Minute erneut beim Server geprüft und nach Saisonende entfernt, auch auf länger geöffneten Startseiten.
- Die Zeiträume bleiben inklusive: Halloween vom 15.10. bis 01.11., Weihnachten vom 01.12. bis 31.12.; maßgeblich ist die Serverzeitzone.
- 21 .NET-Tests und 25 DOM-Tests erfolgreich, einschließlich eines Regressionstests für das Entfernen und erneute Anzeigen der Saisonzeile.
- Nach der Installation Jellyfin neu starten und geöffnete Clients neu laden.

Jelly+ 0.1.6.0 für Jellyfin 12.2 – Platzierung der Saisonempfehlungen im TV-Modus.

- Im TV-Modus wird der Abschnitt für kürzlich hinzugefügte Medien anhand der tatsächlichen Jellyfin-Startseitenkonfiguration ermittelt. Live-TV-Zeilen mit ähnlichem HTML-Aufbau werden nicht mehr als Ziel verwendet.
- Die automatisch ergänzte Bibliothekszeile im TV-Modus wird bei der Zuordnung berücksichtigt. Die Saisonzeile bleibt im bestehenden Latest-Media-Abschnitt und übernimmt dessen CSS-Platzierung.
- Die Platzierungslogik für Web- und Mobilansicht bleibt unverändert.
- 21 .NET- und 24 DOM-Tests erfolgreich. Im laufenden Jellyfin-TV-Webclient wurde der bisherige Fehler mit Live-TV-Zeilen nachgestellt und die Korrektur für zwei Startseitenkonfigurationen geprüft, mit und ohne automatisch ergänzte Bibliothekszeile.

Jelly+ 0.1.5.0 für Jellyfin 12.2 – aktualisierter Saison-Loader.

- Lädt ElegantFin-seasonal.js aus Version 0.1.15 statt 0.1.13.
- Das neue Script begrenzt Partikel auf den Bereich bis unter Media Bar/„Meine Medien“ und berücksichtigt Scrollen, Größenänderungen und nachgeladene Reihen.
- Auch bei bereits vom Theme bereitgestelltem älteren Saison-CSS wird die gemessene Höhe angewendet.

Für die Profil- und Reihenfolgekorrekturen den bisherigen Theme-Zusatzimport ersetzen:

```css
@import url("https://cdn.jsdelivr.net/gh/S3NTIN3LOne/jellyfin-elegantfin-tv@v0.1.15/desktop/jellyplus-support.css");
```

Die Veröffentlichung führt sämtliche .NET- und Webtests vor dem Paketbau aus.

Nach dem Update den Jellyfin-Container neu starten und die LG-App vollständig schließen und erneut öffnen.

Installationsanleitung und Manifest stehen im Repository. Ein Test auf physischer LG-Hardware steht noch aus. Details: TESTING.md.
