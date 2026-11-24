import { expect, it } from "vitest";
import { Attribution } from "ox/erc8021";
import { DATA_SUFFIX, isAttributed, BUILDER_CODE } from "./builderCode";
it("encodes and decodes our Builder Code", () => {
  expect(DATA_SUFFIX!.endsWith("80218021802180218021802180218021")).toBe(true);
  expect(isAttributed(("0xa9059cbb" + "00".repeat(64) + DATA_SUFFIX!.slice(2)) as `0x${string}`)).toBe(true);
  expect(Attribution.fromData(DATA_SUFFIX!)?.codes).toEqual(["bc_h8bwov26"]);
});
