# BirdNET-Analyzer feature request — draft

> Target repo: https://github.com/kahst/BirdNET-Analyzer (Cornell Lab)
> Issue type: feature request / discussion
> Only open if the project accepts such requests — check their issue templates first.

---

**Issue title:** Feature request: stable public API contract for downstream consumers

**Body:**

Hi,

I maintain [Perch](https://github.com/arunrajiah/perch), an open-source mobile companion app for BirdNET-Pi and BirdNET-Go stations. Currently Perch connects via the BirdWeather hosted API, which means users need BirdWeather integration enabled.

A longer-term goal is to support direct connections to self-hosted instances without requiring BirdWeather. To do that reliably, it would help to have a documented, stable HTTP API contract from BirdNET-Analyzer (or the Pi/Go wrappers).

**The ask:**

Would the project consider publishing a minimal API specification — even just a simple JSON schema for the detection output format and, if applicable, any HTTP endpoints that BirdNET-Pi and BirdNET-Go expose? This would make it easier for third-party tools to integrate without parsing undocumented output formats that change between versions.

If this is already documented somewhere I missed, a pointer would be equally helpful.

Happy to contribute documentation or an OpenAPI spec if that would be useful.

Thanks for the incredible work on BirdNET.

— Arun  
https://github.com/arunrajiah/perch

---

> **Note:** This is a speculative issue. Open it only if BirdNET-Analyzer actively accepts feature requests from third-party developers. Check the existing issues and discussions first.
