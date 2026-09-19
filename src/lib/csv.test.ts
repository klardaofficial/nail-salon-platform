import { describe, expect, it } from "vitest";

import { csvDocument } from "./csv";

describe("csvDocument", () => {
  it("prefixes the output with a UTF-8 BOM and joins rows with CRLF", () => {
    const csv = csvDocument([
      ["a", "b"],
      ["c", "d"],
    ]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('"a","b"\r\n"c","d"');
  });

  it("doubles embedded quotes", () => {
    expect(csvDocument([['He said "hi"']])).toContain('"He said ""hi"""');
  });

  it("treats null and undefined as an empty cell", () => {
    expect(csvDocument([[null, undefined]])).toContain('"",""');
  });

  it("prefixes an apostrophe on values that could be read as a spreadsheet formula", () => {
    for (const dangerous of ["=SUM(A1)", "+1", "-1", "@cmd", "\ttabbed"]) {
      expect(csvDocument([[dangerous]])).toContain(`"'${dangerous}"`);
    }
  });

  it("leaves ordinary text untouched", () => {
    expect(csvDocument([["Please use hypoallergenic polish"]])).toContain(
      '"Please use hypoallergenic polish"',
    );
  });
});
