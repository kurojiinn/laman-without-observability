import { describe, expect, it } from "vitest";
import { getPickerActions, statusLabel } from "./model";

describe("order model", () => {
  it("returns only picker-allowed transitions", () => {
    expect(getPickerActions("NEW")).toEqual(["ACCEPTED_BY_PICKER", "CANCELLED"]);
    expect(getPickerActions("ASSEMBLING")).toEqual(["ASSEMBLED", "CANCELLED"]);
    expect(getPickerActions("ASSEMBLED")).toEqual(["CANCELLED"]);
  });

  it("maps status labels", () => {
    expect(statusLabel("NEW")).toBe("Новый");
    expect(statusLabel("NEEDS_CONFIRMATION")).toBe("Нужно уточнение");
  });
});
