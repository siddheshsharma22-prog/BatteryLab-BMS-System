#!/usr/bin/env python3
# Merge cover (Playwright) + body (ReportLab) into the final deliverable
from pypdf import PdfReader, PdfWriter

A4_W, A4_H = 595.28, 841.89
COVER = '/home/z/my-project/scripts/report-cover.pdf'
BODY  = '/home/z/my-project/scripts/report-body.pdf'
OUT   = '/home/z/my-project/download/BatteryLab-Technical-Report-and-User-Guide.pdf'

def normalize(page):
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    if abs(w - A4_W) > 0.1 or abs(h - A4_H) > 0.1:
        page.scale_to(A4_W, A4_H)
    return page

writer = PdfWriter()
writer.add_page(normalize(PdfReader(COVER).pages[0]))
for p in PdfReader(BODY).pages:
    writer.add_page(normalize(p))
writer.add_metadata({
    '/Title': 'BatteryLab - Technical Report & User Guide',
    '/Author': 'Z.ai',
    '/Creator': 'Z.ai',
    '/Subject': 'Detailed technical report and user guide for the BatteryLab virtual battery design and test platform',
})
with open(OUT, 'wb') as f:
    writer.write(f)
print('FINAL PDF:', OUT, '| pages:', len(writer.pages))
