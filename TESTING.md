# Validierung

## Korrekturen in 0.1.4.0

- 21 .NET-Tests und 19 DOM-Tests: Menütext je Quellzeile, initialer Aufruf des nativen `buildCards`, explizite Bildmetadaten, unveränderte Anzahl äußerer Startseitenabschnitte und Ausschluss von Live-TV-Links als Einfügeziel.
- Der Testfilm hat nun eine reale lokale PNG-Posterdatei. Im Browser wurden der gesetzte native Hintergrundbild-Link, HTTP 200 und erfolgreiches Dekodieren mit Bildmaßen 248 × 372 geprüft. Zuvor enthielt die Testbibliothek keine Poster; damit ließ sich deren tatsächliche Anzeige nicht bestätigen.
- Visuelle Koordinaten geprüft für normalen Aufbau, Flex mit `nth-child`-Sortierung, CSS Grid und `display: contents`: Next Up liegt vor der Saisonzeile; die erste sichtbare Zeile kürzlich hinzugefügter Medien liegt danach. Die äußere Anzahl von zehn Startseitenabschnitten bleibt unverändert.
- Im echten Medienmenü aus beiden nativen Zeilen die exakten Texte „Aus ‚Weiterschauen‘ ausblenden“ und „Aus ‚Als nächstes‘ ausblenden“ geprüft.
- Die aktuell beim Nutzer eingesetzten CSS-Regeln wurden angefragt, liegen bisher aber nicht vor. Die vier Browserfälle prüfen deshalb die genannten Sortiermechanismen und nicht dessen vollständige individuelle CSS-Datei.

## Korrekturen in 0.1.3.0

- 21 .NET-Tests und 16 DOM-Tests prüfen unter anderem die Delegation an Jellyfins Kartenrenderer und Action Sheets, native Menüstruktur und Checkbox, Einbindung innerhalb des Wiedergabeformulars sowie die dynamische Übernahme des CSS-`order`-Wertes.
- Mit Jellyfin 12.2 und Edge: 14 Testfilme als native Karten, native Links-/Rechts-Pfeile, Medienmenüpunkte ohne eigene Raised-Buttons und erfolgreiche native Profilauswahl.
- Standarddesign und der von `jellyfin-elegantfin-tv` v0.1.13 bezogene ElegantFin-Desktopstil wurden visuell geprüft. Eine zusätzliche CSS-Sortierung mit Next Up vor den zuletzt hinzugefügten Medien hält auch die saisonale Zeile nach Next Up und direkt vor den zuletzt hinzugefügten Medien.
- Die lokale Testbibliothek enthält künstliche Filme ohne Poster. Die Screenshots dienen der Prüfung von Kartenmaßen, Steuerelementen, Formularbreite und Menüdarstellung.

## Korrekturen in 0.1.2.0

- 21 .NET-Tests und 15 DOM-Tests: verzögert verfügbarer API-Client, versionsabhängiger Script-Verweis, einmaliges Laden des angeforderten Seasonal-Scripts ohne CSS-Nachladen sowie korrekte Zeilenposition bei nachträglich aufgebauten Desktop- und TV-Startseiten.
- Mit Jellyfin 12.2 und Edge am 21.10.2026 in den Layouts `desktop`, `desktop-legacy`, `mobile` und `tv` geprüft: Profileinstellung sichtbar, Watch-Together-Menü sichtbar, Empfehlungen vor dem ersten Bereich für zuletzt hinzugefügte Medien, keine JavaScript-Seitenfehler.
- Die unveränderte, von der angegebenen jsDelivr-URL geladene v0.1.13-Datei wurde im Browsertest als Netzwerkantwort bereitgestellt: Desktop und Mobil initialisieren `ElegantFinSeasonal`, ohne einen zusätzlichen Effekt-CSS-Link zu erstellen. Im TV-Layout wird das Desktop-Script nicht geladen.
- Die konkrete Browseradresse und Oberfläche des gemeldeten Ausfalls sind noch nicht bekannt. Die Tests bestätigen die genannten Layouts der serverseitig ausgelieferten Weboberfläche.

## Korrekturen in 0.1.1.0

- 21 .NET-Tests und 10 DOM-Tests bestehen, einschließlich profilabhängiger Menüs, verborgen bleibender Karten nach Cache-Neudarstellung, Berechtigungen der Kartenauflösung und Wiederholung fehlgeschlagener saisonaler Anfragen.
- Im echten Browser mit `layout=tv`: saisonale Zeile sichtbar; nach Abschalten der Profilfreigabe kein Watch-Together-Menüpunkt; Ausblenden über das Kontextmenü entfernt die Karte ohne Dokumentnavigation.
- Genre-Erkennung mit einem neutral benannten Testfilm geprüft, dessen einzige saisonale Zuordnung das Genre Horror ist.
- Der gemeldete Absturz der physischen webOS-App ist mangels Gerät/Logs nicht direkt reproduziert. Der bisherige vollständige Seitenneustart wurde entfernt.

## Durchgeführte Integrationstests

Am 20.10.2026 lokal mit dem offiziellen Jellyfin-12.2-Windows-Paket und Edge (headless):

- Plugin lädt, HTML-Einbindung aktiv, Profiloption im echten Webclient sichtbar.
- Saisonale Zeile mit lokalem Horror-Testfilm sichtbar.
- Drei-Punkte-Menü → Profilauswahl → Fortschrittsübernahme erfolgreich.
- Bibliotheks-Zufällig-Button öffnet eine Detailseite, ohne Wiedergabe zu starten.
- Zwei echte Testprofile: Gesehen/Ungesehen in beide Richtungen und Position von 120 Sekunden übertragen.
- Serienverknüpfung umfasst beide Testepisoden; Episodenstatus wird übertragen.
- „Weiterschauen“ und „Als nächstes“ filtern ausgeblendete Medien; manuelles Wiederanzeigen und Rückkehr bei anderer Episode geprüft.

Diese Prüfungen ergänzen die automatisierten Tests; sie ersetzen die noch ausstehende Geräteabnahme auf Unraid und LG webOS nicht.

## Automatisiert

- Saisonale Datumsgrenzen, Metadatenzuordnung und Profilgruppen.
- Persistenz nach Neustart und Rücknahme fehlgeschlagener Zustandsänderungen.
- Erforderliche Freigabe beider Profile und Zugriff auf das Medium.
- Fortschrittsübernahme in beide Richtungen ohne Übernahme persönlicher Favoriten.
- Ablehnung veralteter Konfliktentscheidungen und Ende der Synchronisierung nach Deaktivierung.
- Wiederherstellen ausgeblendeter Filme beim Wiedergabestart.
- HTML-Einbindung mit und ohne Base URL, unveränderte Dateien und unberührte Streamingpfade.
- DOM-Tests für Profilfreigabe, Drei-Punkte-Menü, sichere Metadatendarstellung, Zufällig zur Übersicht und Fernbedienungstasten im Dialog.

## Geräteabnahme vor stabiler Freigabe

Auf dem Unraid-Server und einem echten LG-webOS-Gerät prüfen:

1. Plugin über Manifest installieren; Container und TV-App neu starten. Webdateien bleiben unverändert.
2. Zwei Testprofile mit unterschiedlich eingeschränkten Bibliotheken verwenden. Beide aktivieren Watch Together.
3. Film und Serie jeweils mit abweichendem Fortschritt verknüpfen; beide Ausgangsprofile ausprobieren. Nicht zugängliche Medien dürfen nicht übertragen werden.
4. Im Browser starten, am TV stoppen; Fortschritt und Gesehen-Status beim Partner prüfen. Auch „als ungesehen markieren“ prüfen.
5. Freigabe deaktivieren und kontrollieren, dass weitere Änderungen nicht übertragen werden.
6. Film und Episode ausblenden. Die Serie darf erst beim Start einer anderen Episode zurückkehren. Manuelles Wiederanzeigen prüfen.
7. Saisonale Zeile innerhalb und außerhalb beider Zeiträume sowie bei deaktivierter Admin-Option prüfen.
8. Zufällig in Film- und Serienbibliothek führt zur Detailseite; deaktivierte Option behält Jellyfins Verhalten bei.
9. Alle Dialoge mit Pfeiltasten, OK und Zurück bedienen, einschließlich langer Profilnamen und vieler Profile.
10. Jellyfin mit konfigurierter Base URL hinter dem vorhandenen Proxy prüfen und Container erneut erstellen; persistierte Einstellungen müssen erhalten bleiben.

Ein erfolgreicher Build oder DOM-Test allein bestätigt keine vollständige Kompatibilität mit allen webOS-Versionen.
