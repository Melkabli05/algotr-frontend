import { money, percent, quantity, signedMoney, signedPercent, time, tone } from "../format";

type Value = { value: number | null | undefined };

export const moneyCell = (params: Value): string => money(params.value);
export const signedMoneyCell = (params: Value): string => signedMoney(params.value);
export const percentCell = (params: Value): string => percent(params.value, 1);
export const signedPercentCell = (params: Value): string => signedPercent(params.value);
export const quantityCell = (params: Value): string => quantity(params.value);
export const timeCell = (params: { value: string | null | undefined }): string =>
  params.value ? time(params.value) : "—";

export const toneClass = (params: { value: number | null | undefined }): string =>
  `num ${tone(params.value)}`;
export const numClass = "num";
