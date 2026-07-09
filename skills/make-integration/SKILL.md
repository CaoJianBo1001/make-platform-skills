---
name: make-integration
description: Use when the user asks to recognize invoices, bills, receipts, tickets, or other voucher files with Make Integration services. Also triggered by requests like "发票内容", "识别发票", "票据 OCR", "ocr 这张图片", or "验真发票". Does not manage Make resources (use makecli), design DSL schemas (makedsl), build UI (makeui), implement auth (make-app-auth), Service/API code (make-app-service), runtime packaging (make-app-runtime), or perform non-Make OCR outside makecli integration commands.
metadata:
  version: 0.2.4
---

# make-integration

## When to use

Use this skill when the user needs Make Platform integration capabilities, especially OCR recognition for invoices and bills.

Current capability:

- Bill and invoice OCR through `makecli integration ocr`
- Optional invoice authenticity verification
- Structured extraction for PDF/OFD/PNG/JPG/JPEG files
- Returned invoice fields, stamps, QR codes, coordinates, and optional crop images

## Dependency

make-integration depends on the `makecli` skill and the installed `makecli` binary.

## Instructions

### Pre-flight check

Before running OCR:

0. Check `makecli` is installed.
   - Missing: run `brew tap qfeius/makecli && brew install makecli`

1. Check the OCR command exists.
   - Run `makecli integration ocr --help`
   - If the command is missing, run `makecli update` or upgrade makecli.

2. Check the selected profile.
   - Run `makecli configure verify --profile <profile> --output=json`
   - If not configured, tell the user to run the interactive setup:
     `! makecli configure token --profile <profile>`
   - If the token is invalid or missing, stop and ask the user to configure makecli credentials. Do not recognize, extract, infer, correct, or complete invoice content outside makecli.

3. Check the request base URL from makecli.
   - Run `makecli configure get server-url --profile <profile>`
   - Prefer using the profile-configured server URL instead of hard-coding an environment URL.
   - If the profile has no server URL, makecli uses its own default base URL.

4. Check the input file.
   - Supported extensions: `.pdf`, `.ofd`, `.png`, `.jpg`, `.jpeg`
   - Only upload files provided or approved by the user.

### Recognition workflow

Use table output when the user only needs a readable answer:

```bash
makecli integration ocr -f <file> --profile <profile>
```

Use JSON output when you need to parse fields or feed the result into another Make operation:

```bash
makecli integration ocr -f <file> --output=json --profile <profile>
```

Common options:

```bash
# Recognize selected pages
makecli integration ocr -f invoice.pdf --pages "1,3,2"
makecli integration ocr -f invoice.pdf --pages "2-4"

# Bind a business document id
makecli integration ocr -f invoice.pdf --business-id <business-id>

# Explicitly disable invoice authenticity verification
makecli integration ocr -f invoice.pdf --verify-vat=false

# Optional response controls
makecli integration ocr -f invoice.pdf --coord-restore-original
makecli integration ocr -f invoice.pdf --crop-complete
makecli integration ocr -f invoice.pdf --crop-value
makecli integration ocr -f invoice.pdf --merge-elec
makecli integration ocr -f invoice.pdf --return-ppi
```

### Output handling

For `--output=json`, summarize from:

```text
data.file_name
data.bill_count
data.processing_duration_ms
data.result.pages[].bills[].items[]
data.result.pages[].bills[].stamps[]
data.result.pages[].bills[].qr_codes[]
```

When reporting results to the user:

- Include file name, bill count, page count, and processing duration when available.
- Extract non-empty `items[].value` fields.
- Include stamps and QR codes when they are present and useful.
- Keep base64 crop payloads out of normal summaries.
- Report recognized OCR values only from successful `makecli integration ocr` output.
- Treat only `makecli integration ocr` output as the recognition result. Do not use visual inspection, model knowledge, file parsing, alternate OCR tools, direct HTTP calls, or user-visible image content to recognize or fill invoice data.
- Mask or replace special and personal information only in skill documentation examples, committed samples, logs, or debug snippets.
- If the OCR result will be written to Make records, invoke the `makecli` skill for record operations after recognition.

### Failure handling

- `API 错误 [990300403]: token验证失败`
  - The token is invalid for the selected environment. Ask the user to configure a token valid for that environment, then retry OCR through makecli.
- `API 错误 [990300404]: 服务不存在`
  - The selected makecli server URL likely has not deployed the OCR route. Check the profile server URL or confirm deployment.
- `unsupported file extension`
  - Ask for a supported PDF/OFD/PNG/JPG/JPEG file.
- `打开文件失败`
  - Check the local path and permissions.
- Any makecli OCR failure
  - Report the makecli failure and the next makecli configuration or environment step. Do not continue by recognizing the invoice content yourself.

### Hard rules

- Do not write user-provided tokens into repository files.
- Prefer temporary config directories when the user provides a one-off token.
- Clean up temporary credentials and OCR result files after the run unless the user asks to keep them.
- Never print, commit, or duplicate tokens.
- Do not upload local files unless the user provided or approved them.
- Do not commit real invoice numbers, taxpayer IDs, order numbers, phone numbers, addresses, tokens, QR payloads, or other sensitive values in skill examples.
- Do not use any non-makecli path as a fallback for this skill. If makecli cannot run or OCR fails, fix makecli configuration/environment first and retry through makecli.
