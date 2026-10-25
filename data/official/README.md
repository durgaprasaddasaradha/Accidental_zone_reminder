# Official Road Safety Data Directory

This directory is designated for **officially verified Government road-accident data**, specifically:
- Ministry of Road Transport and Highways (MoRTH), Government of India
- Open Government Data (OGD) Platform India (data.gov.in)
- Official Black-Spot Identification Reports & Notification Datasets

## Architecture & Integration Rule

1. **No Invented APIs**:
   This project does not assume or invent private/undocumented government API endpoints or API keys.
2. **Adapter Pattern**:
   The backend provides `OfficialDataSource` in `api/services/official_data_service.py`. When an official dataset (CSV/JSON format) is downloaded from MoRTH or data.gov.in, place it in this directory.
3. **Future Live API**:
   When official API access and credentials are confirmed by an authorized authority, the `OfficialDataSource.fetch_data()` method can be extended without altering any database models, API schemas, or frontend components.
4. **Source Attribution**:
   Every record processed through this directory must carry verified source attribution (e.g., `MORTH_BLACK_SPOT_2023`, source URL, and publication date).
