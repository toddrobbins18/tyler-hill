import zipfile
import re
import xml.etree.ElementTree as ET

path = r"C:\Users\Admin\Downloads\Document from Zayn.xlsx"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

with zipfile.ZipFile(path) as z:
    ss_root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    strings = []
    for si in ss_root.findall(".//m:si", NS):
        parts = [t.text or "" for t in si.findall(".//m:t", NS)]
        strings.append("".join(parts))

    sheet_root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    rows_out = []
    for row_el in sheet_root.findall(".//m:sheetData/m:row", NS):
        row_vals = []
        for c in row_el.findall("m:c", NS):
            ref = c.get("r", "")
            t = c.get("t")
            v_el = c.find("m:v", NS)
            is_el = c.find("m:is", NS)
            val = ""
            if is_el is not None:
                val = "".join(t_el.text or "" for t_el in is_el.findall(".//m:t", NS))
            elif v_el is not None and v_el.text is not None:
                if t == "s":
                    val = strings[int(v_el.text)]
                else:
                    val = v_el.text
            row_vals.append(val)
        rows_out.append(row_vals)

print("Sheet rows:", len(rows_out))
for i, r in enumerate(rows_out[:8]):
    print(f"Row {i}:", r)
