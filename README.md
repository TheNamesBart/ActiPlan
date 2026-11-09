# ActiPlan

Een gevibecode website voor het maken van activiteitenplanningen. De planning staat in een leesbaar JSON-bestand; er is geen backend of account. Niet-opgeslagen wijzigingen kunnen tijdelijk lokaal in de browser worden hersteld.

## Projectstructuur

- `docs/index.html` - applicatiescherm.
- `docs/css/styles.css` - scherm- en A4-printopmaak.
- `docs/css/components.css` - gedeelde interactieve componenten en toegankelijkheidsstijlen.
- `docs/js/core.js` - JSON-validatie, kalender-, herhalings- en ordeningslogica.
- `docs/js/app.js` - gebruikersinterface, bewerken, importeren en opslaan.
- `docs/js/ui.js` - gedeelde UI-hulpfuncties.
- `docs/js/dialogs.js` - consistente bevestigings- en invoerdialogen.
- `tests/` - zelfstandige browser-tests zonder externe bibliotheken.
- `docs/manifest.json` - basisinstellingen voor statische hosting.test

## Gebruiken en testen

Open `docs/index.html` via een lokale webserver in Edge of Firefox, of publiceer de map `docs/` als statische site. Kies daarna een bestaande `.json`-planning, maak een nieuwe planning of laad de voorbeeldplanning.

Open `tests/tests.html` om de automatische tests uit te voeren. De tests controleren onder meer JSON opslaan/importeren, deadlines en printrelevante activiteiten. Een deadline buiten de tijden van het gekozen dagdeel geeft in het activiteitformulier een waarschuwing; opslaan blijft mogelijk wanneer dit bewust gewenst is. Niet-opgeslagen wijzigingen worden tijdelijk lokaal bewaard en bij een volgend bezoek aangeboden voor herstel. Voor lokale ontwikkeling is geen installatie of buildproces nodig. Een lokale webserver kan nodig zijn wanneer een browser ES-modules vanaf `file://` blokkeert.