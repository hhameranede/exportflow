# Dicom connector research and normalizer prototype

**Status:** isolated research prototype only. This is not an enabled carrier adapter, a public tracking route, an API-access grant, or a live-tested integration.

## Source comparison

The pinned ExportFlow runtime (`universal-parcel-scraper@0.977.1`, commit `e64a466772ef25ce68e02d9c7c9f1613eec1208b`) has no `dicom` carrier directory. Karrio Community has a Dicom tracking extension with a tracking response schema and mock tests:

- Source repository: https://github.com/karrioapi/community
- Audited source revision: `4d5303d8c66bee2b605f1d9ea35c105cb5725471`
- Tracking parser: https://github.com/karrioapi/community/blob/4d5303d8c66bee2b605f1d9ea35c105cb5725471/plugins/dicom/karrio/providers/dicom/tracking.py
- Tracking response model: https://github.com/karrioapi/community/blob/4d5303d8c66bee2b605f1d9ea35c105cb5725471/plugins/dicom/karrio/schemas/dicom/tracking.py
- Mock tracking tests: https://github.com/karrioapi/community/blob/4d5303d8c66bee2b605f1d9ea35c105cb5725471/plugins/dicom/tests/dicom/test_tracking.py

The schema contains activity fields such as activity date, status, description, code and terminal. It also contains additional shipment-level fields, including sender/consignee objects, notes and activity image metadata. ExportFlow's prototype deliberately allowlists only the tracking identifier and a small set of event fields.

## Licensing evidence and limitation

The Community README's License section says Apache-2.0, while the repository's actual root `LICENSE` file contains LGPL-3.0 text and the Dicom package's `pyproject.toml` declares `LGPL-3.0`. No Dicom-specific LICENSE file exists in the audited tree. Treat the upstream Dicom package as LGPL-3.0 for further review; do not rely on the contradictory README sentence.

**No Karrio source code was copied into this prototype.** The ExportFlow normalizer is an independent implementation over a small synthetic JSON shape. This does not eliminate the need for a proper license review before any future code import.

## Access and product boundary

The Karrio Dicom settings specify Basic authentication with an account username/password against the Dicom Smart4i service (`https://smart4i.dicom.com`, with a separate sandbox host). The tracking proxy calls `GET /v1/tracking/{tracking_number}`. This is an account-authenticated service path, not evidence of anonymous consumer tracking or authorization for ExportFlow to process third-party users' parcel IDs.

The upstream tests use mocks/fixtures. No live Dicom API request, credential, customer record or real tracking number was used in this review.

## Prototype behavior

File: `functions/lib/dicom-normalizer.mjs`.

- Accepts a single shipment response or a list of return-code envelopes containing a shipment.
- Requires the response's tracking identifier to match the optional requested identifier.
- Normalizes a bounded event list, newest first, with a conservative generic stage map.
- Drops malformed timestamps and duplicate events.
- Projects only tracking number, carrier, current status and event time/location/description/code/stage.
- Does not copy sender, consignee, recipient address/contact, notes, parcel, signature, image URL, coordinate or other account data.
- Performs no network access, authentication, logging or writes to carrier systems.

The stage mapping is a first prototype and must be checked against a fuller set of licensed/authorized Dicom examples before it is treated as production-grade.

## Tests and release boundaries

Run `npm run test:dicom-normalizer` or the full `npm test`. Tests use synthetic values only. There is no live adapter registration, no change to `/api/track`, no change to the carrier catalog, and no change to coverage output.

This branch is not merged or deployed. Carrier API eligibility, credentials, customer/merchant authority, privacy obligations, and public recipient-facing display rights remain unverified.
