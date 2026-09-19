const BOM = String.fromCharCode(0xfeff);

export function csvDocument(rows: readonly unknown[][]) {
  return (
    BOM +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? "");
            if (/^[=+\-@\t\r\n]/.test(text)) text = `'${text}`;
            return `"${text.replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\r\n")
  );
}
