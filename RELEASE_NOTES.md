Jelly+ 0.1.4.0 für Jellyfin 12.2 – Menütexte, Poster und Startseitenplatzierung.

- Das Ausblenden-Menü benennt nur die Zeile, aus der es geöffnet wurde: „Als nächstes“ oder „Weiterschauen“.
- Die saisonalen Karten fordern Bildmetadaten ausdrücklich an und starten Jellyfins nativen Bildlader beim ersten Aufbau.
- Die Saisonzeile sitzt innerhalb des bestehenden Abschnitts für kürzlich hinzugefügte Medien. Zusätzliche äußere Layout-Elemente und eigene `order`-Werte entfallen; CSS-Sortierung über Flex, `nth-child`, Grid und `display: contents` bleibt erhalten.
- 21 .NET- und 19 Oberflächentests erfolgreich. Zusätzlich im Browser geprüft: Posterabruf mit HTTP 200 und erfolgreicher Bilddekodierung, beide Menütexte sowie die visuelle Position in vier Layoutvarianten.

Nach dem Update den Jellyfin-Container neu starten, die Browserseite neu laden und die LG-App vollständig schließen und erneut öffnen.

Installationsanleitung und Manifest stehen im Repository. Die Browser-Erweiterung setzt die vom Jellyfin-Server ausgelieferte Weboberfläche voraus. Ein Test auf physischer LG-Hardware steht noch aus. Details und Prüfschritte: TESTING.md.
