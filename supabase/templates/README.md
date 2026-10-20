# Supabase e-mailtemplates

De resetmail wordt door Supabase verstuurd. Deze HTML staat ook in het dashboard
onder **Authentication → Emails → Reset password**.

- Onderwerp: `Wachtwoord herstellen · Strik Team App`
- Body: de volledige inhoud van `reset-password.html`
- Behoud `{{ .ConfirmationURL }}` bij de knop én de alternatieve link.

Gebruik in een lokale preview een fictieve link in plaats van een echte resetlink.
Deze mail gebruikt inline stijlen en tabellen voor e-mailclients. Het Strik-logo
wordt vanaf het openbare appadres geladen; de tekst en knop werken ook zonder
afbeeldingen. De opmaak wijzigt geen wachtwoord of instellingen voor authenticatie.
