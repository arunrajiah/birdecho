/**
 * Device language as a two-letter code ("it", "de"), or null for English and
 * when it cannot be determined. BirdWeather returns localized common names
 * when asked with `?locale=`, so every BirdWeather request carries this.
 * BirdNET-Pi and BirdNET-Go stations name species in whatever language the
 * station itself is configured for, so nothing is sent to them.
 */
export function deviceLanguage(): string | null {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    const lang = tag.split(/[-_]/)[0]?.toLowerCase() ?? '';
    return /^[a-z]{2,3}$/.test(lang) && lang !== 'en' ? lang : null;
  } catch {
    return null;
  }
}
