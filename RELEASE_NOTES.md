Jelly+ 0.1.3.0 für Jellyfin 12.2 – native Darstellung und Reihenfolge bei Custom-CSS.

- Saisonale Empfehlungen verwenden Jellyfins Kartenrenderer und nativen Scroller mit Desktop-Pfeiltasten. Der eigene Posteraufbau mit sichtbarer Scrollleiste entfällt.
- Die Zeile übernimmt die CSS-Reihenfolge des Abschnitts für zuletzt hinzugefügte Medien und bleibt auch auf umsortierten Startseiten unmittelbar davor.
- Watch Together und Ausblenden erscheinen als normale Medienmenüpunkte mit Icons. Auswahl- und Bestätigungsdialoge verwenden Jellyfins Action Sheets.
- Die Profilfreigabe steht innerhalb des Wiedergabeformulars vor Speichern und verwendet die native Checkbox, Beschreibung und Schaltfläche.
- 21 .NET-Tests und 16 Oberflächentests sowie Browserprüfungen mit Standarddesign, ElegantFin und einer per CSS umsortierten Startseite.

Nach dem Update den Jellyfin-Container neu starten, die Browserseite neu laden und die LG-App vollständig schließen und erneut öffnen.

Installationsanleitung und Manifest stehen im Repository. Die Browser-Erweiterung setzt die vom Jellyfin-Server ausgelieferte Weboberfläche voraus. Ein Test auf physischer LG-Hardware steht noch aus. Details und Prüfschritte: TESTING.md.
