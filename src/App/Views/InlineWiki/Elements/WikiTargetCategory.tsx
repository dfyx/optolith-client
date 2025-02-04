import * as React from "react";
import { Record, RecordBase } from "../../../../Data/Record";
import { L10nRecord } from "../../../Models/Wiki/L10n";
import { WikiProperty } from "../WikiProperty";

interface Accessors<A extends RecordBase> {
  target: (r: Record<A>) => string
}

export interface WikiTargetCategoryProps<A extends RecordBase> {
  x: Record<A>
  acc: Accessors<A>
  l10n: L10nRecord
}

export function WikiTargetCategory<A extends RecordBase> (props: WikiTargetCategoryProps<A>) {
  const {
    x,
    acc,
    l10n,
  } = props

  return (
    <WikiProperty l10n={l10n} title="targetcategory">
      {acc.target (x)}
    </WikiProperty>
  )
}
