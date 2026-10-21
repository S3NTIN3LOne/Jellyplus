# Jelly+

Ein Server-Plugin für **Jellyfin 12.2**, das gemeinsamen Wiedergabefortschritt und zusätzliche Funktionen in Jellyfin Web und dem darauf basierenden LG-webOS-Client bereitstellt.

**Status: Vorschau (0.1.4.0).** Die Integration wurde in Jellyfin Web 12.2 mit Desktop-, klassischer Desktop-, Mobil- und TV-Ansicht geprüft. Ein Test auf einem echten LG-Fernseher steht noch aus. Andere native Clients gehören nicht zum unterstützten Umfang.

## Installation auf Unraid / Docker

1. In Jellyfin unter **Dashboard → Plugins → Repositorys** dieses Repository hinzufügen:

   ```text
   https://raw.githubusercontent.com/S3NTIN3LOne/Jellyplus/main/manifest.json
   ```

2. Im Katalog **Jelly+** installieren und den Jellyfin-Container neu starten.
3. Browser neu laden beziehungsweise die LG-App vollständig schließen und wieder öffnen.
4. Unter **Dashboard → Plugins → Jelly+** die serverweiten Einstellungen festlegen.

Das bestehende Docker-Image bleibt unverändert. Kein JavaScript-Injector, zusätzlicher Container oder Reverse-Proxy ist nötig. Jelly+ liest die vorhandene `index.html` und ergänzt nur die HTTP-Antwort um seinen eigenen Script-Verweis. Es schreibt keine Webdateien. Das normale persistente Jellyfin-Konfigurationsvolume muss vorhanden sein, damit Plugins und Einstellungen Container-Updates überstehen.

## Funktionen

### Watch Together

- Unter **Profil → Wiedergabe → Jelly+** aktiviert jeder Nutzer **Watch Together**. Damit gibt er sich für Verknüpfungen durch andere aktivierte Profile frei.
- Im Drei-Punkte-Menü eines Films, einer Serie oder einer Episode **Watch Together** wählen. Episoden verknüpfen die zugehörige Serie.
- Der Menüpunkt erscheint ausschließlich bei aktivierter Profilfreigabe.
- Medienmenü und Profilauswahl verwenden Jellyfins Menüelemente. Die Freigabe steht im Wiedergabeformular vor dem Speichern-Button und verwendet Jellyfins Checkbox und Beschreibungstext.
- Profil auswählen und festlegen, welcher Fortschritt übernommen werden soll. Bei Serien gilt diese Auswahl für die gemeinsam zugänglichen Episoden.
- Abspielposition, Gesehen-Status, Wiedergabezähler und letztes Wiedergabedatum werden geteilt. Favoriten, Bewertungen und Audio-/Untertitelpräferenzen bleiben persönlich.
- Verknüpfungen sind beidseitig und können Gruppen bilden. Die Auswahl beim Verbinden gilt für alle beteiligten Gruppenmitglieder; der Dialog nennt deren Anzahl. Beim späteren Abspielen gewinnt die zuletzt verarbeitete Änderung.
- Bestehende Verknüpfungen lassen sich im gleichen Menü entfernen. Abschalten der Profilfreigabe entfernt sämtliche direkten Verknüpfungen dieses Profils. Bereits übertragener Fortschritt wird nicht rückgängig gemacht.
- Die Bibliotheks- und Altersfreigaben jedes Empfängerprofils werden berücksichtigt. Änderungen während einer offenen Konfliktabfrage führen zu einer erneuten Auswahl.

### Saisonale Empfehlungen

- **01.12.–31.12.: Weihnachten** anhand von Titeln, Beschreibungen, Genres und Tags wie „Christmas“, „Weihnachten“ und „Heiligabend“.
- **15.10.–01.11.: Halloween** einschließlich Horrorfilmen.
- Bis zu 40 passende Filme als eigene Startseitenzeile; administrativ abschaltbar. Es werden nur für das angemeldete Profil zugängliche Medien angezeigt.
- Die Zeile verwendet Jellyfins Kartenrenderer und Scroller einschließlich nativer Pfeiltasten in der Desktopansicht. Größen, Abstände, Icons und Farben folgen den normalen Medienkarten und dem aktiven Theme. Es gibt keine eigene Poster-Scrolleiste.
- Die Zeile steht unmittelbar vor dem ersten Abschnitt mit kürzlich hinzugefügten Medien. Bibliotheken, „Als nächstes“ und „Weiterschauen“ behalten dabei die vom Nutzer gewählte Reihenfolge. Fehlt ein Abschnitt für zuletzt hinzugefügte Medien, wird die Zeile am Ende ergänzt. Fehlgeschlagene Anfragen werden erneut versucht; ohne passende Filme oder außerhalb der Zeiträume erscheint keine Zeile.
- Die Zeile wird innerhalb des bestehenden Startseitenabschnitts für kürzlich hinzugefügte Medien eingefügt. Sie erzeugt keinen zusätzlichen äußeren Abschnitt und verschiebt dadurch keine `nth-child`-Selektoren. Flex-, Grid- und `display: contents`-Layouts verwenden weiterhin die Position des vorhandenen Abschnitts.
- Bildmetadaten werden ausdrücklich angefordert. Der erste Aufbau verwendet Jellyfins `buildCards` inklusive Bildlader, auch wenn das native Items-Container-Element noch initialisiert wird.
- Die Zeiträume sind inklusive; maßgeblich ist die Serverzeitzone. Auf Unraid kann hierfür `TZ=Europe/Berlin` am Container gesetzt werden.

### Saisonale Effekte des Themes

In Desktop- und Mobilansicht lädt Jelly+ einmalig [ElegantFin-seasonal.js v0.1.13](https://cdn.jsdelivr.net/gh/S3NTIN3LOne/jellyfin-elegantfin-tv@v0.1.13/desktop/ElegantFin-seasonal.js). Die Effektgestaltung wird vom vorhandenen lokalen CSS-Theme übernommen; das Plugin unterdrückt den zusätzlichen CSS-Nachlader dieses Scripts. Die Script-Datei selbst wird über jsDelivr geladen.

Das Script entscheidet anhand von Datum, Medien und Systemeinstellung für reduzierte Bewegung, ob Effekte erscheinen. Im TV-Layout wird das Desktop-Script nicht geladen. Die Effekte sind unabhängig vom Admin-Schalter für die Empfehlungszeile.

### Zufällig zur Übersicht

Die Admin-Option lässt die Bibliotheks-Schaltfläche **Zufällig** einen zufälligen Titel aus der aktuellen Bibliothek auswählen und dessen Detailseite öffnen. Die Auswahl verwendet die Bibliothek, nicht zusätzliche aktive Ansichtsfilter. Wiedergabe startet erst auf ausdrückliche Auswahl des Nutzers.

### Startseite aufräumen

Im Drei-Punkte-Menü **Aus „Als nächstes“ ausblenden** beziehungsweise **Aus „Weiterschauen“ ausblenden** auswählen. Der Text richtet sich nach der Zeile, aus der das Menü geöffnet wurde; außerhalb dieser Zeilen heißt er **Auf der Startseite ausblenden**. Episoden blenden ihre gesamte Serie für das eigene Profil aus. Der Wiedergabefortschritt bleibt erhalten.

Die Karten werden nach erfolgreichem Speichern direkt ausgeblendet. Es erfolgt kein vollständiger Seitenneustart; bereits zwischengespeicherte Startseitenkarten werden ebenfalls berücksichtigt.

Eine Serie kehrt zurück, wenn das Profil eine andere Episode als die zuletzt abgespielte startet. Dabei zählt auch die bisher ungestartete Episode, deren „Als nächstes“-Karte ausgeblendet wurde. Ein Film kehrt bei erneutem Wiedergabestart zurück. Unter **Profil → Wiedergabe → Ausgeblendete Medien verwalten** kann man Medien jederzeit wieder zulassen.

Die Filterung erfolgt nach Jellyfins Seitenauswahl. Daher kann eine Zeile nach dem Ausblenden zunächst weniger Einträge enthalten, als ihre normale maximale Anzahl erlaubt.

## Entwicklung und Tests

Voraussetzungen: .NET SDK 10 und Node.js 24.

```sh
dotnet test -c Release
npm ci --ignore-scripts
npm test
```

Paket und Manifest erstellen (PowerShell 7 oder Windows PowerShell):

```powershell
./scripts/package.ps1 -Version 0.1.4.0 -Repository S3NTIN3LOne/Jellyplus
```

Das ZIP enthält ausschließlich die Plugin-DLL einschließlich eingebetteter Webressourcen. Die Jellyfin-Assemblies liefert der Server. Der GitHub-Workflow **Publish release** erstellt nach erfolgreichen Tests eine Vorabversion und aktualisiert das Manifest. Vor einer stabilen Freigabe die Geräteprüfungen in [TESTING.md](TESTING.md) durchführen.

Jelly+ speichert seine Profilfreigaben, Verknüpfungen und ausgeblendeten Medien atomar unter `<Jellyfin DataPath>/jellyplus/state.json`. Die serverweiten Optionen liegen in der normalen Plugin-Konfiguration. Beim Deinstallieren bleiben diese Daten bestehen; die Oberflächen-Erweiterung entfällt nach Serverneustart und Neuladen des Clients.

## Technische Grenzen

Die UI-Einbindung ist eine versionsgebundene Erweiterung, keine offizielle Jellyfin-Web-Plugin-Schnittstelle. Jellyfin-Web-Updates können Anpassungen erforderlich machen. Der Client muss die Weboberfläche dieses Servers verwenden; eine separat gehostete Web-App erhält die Plugin-Erweiterung nicht. Geteilte Fortschritte sind keine synchronisierte Streaming-Sitzung.

Für Karten und Auswahldialoge verwendet Jelly+ die bereits gebündelten nativen UI-Module von Jellyfin 12.2. Diese werden anhand ihrer Exporte erkannt; feste Modulnummern werden nicht verwendet. Es werden keine Webdateien oder Bundles umgeschrieben.

Beim erstmaligen Verknüpfen werden Fortschritte über Jellyfins öffentliche Dienste einzeln gespeichert. Ein Fehler kann bereits übertragene Einträge hinterlassen; die Verknüpfung wird erst nach erfolgreichem Kopieren gespeichert. Eine erneute Auswahl gleicht die Einträge ab.

Lizenz: [GPL-3.0-only](LICENSE).
