import * as React from "react";
import { fmapF } from "../../../Data/Functor";
import { List, toArray } from "../../../Data/List";
import { isJust, isNothing, Just, Maybe, maybe, maybeToNullable, Nothing } from "../../../Data/Maybe";
import { lookup, OrderedMap } from "../../../Data/OrderedMap";
import { Record } from "../../../Data/Record";
import { L10nRecord } from "../../Models/Wiki/L10n";
import { Spell } from "../../Models/Wiki/Spell";
import { translateP } from "../../Utilities/I18n";
import { lte } from "../../Utilities/mathUtils";
import { BorderButton } from "../Universal/BorderButton";
import { Checkbox } from "../Universal/Checkbox";

interface SelectionsCursesProps {
  active: OrderedMap<string, number>
  apLeft: number
  apTotal: number
  change (id: string): (maybeOption: Maybe<"add" | "remove">) => void
  list: List<Record<Spell>>
  l10n: L10nRecord
}

export function SelectionsCurses (props: SelectionsCursesProps) {
  const { active, apTotal, apLeft, change, list, l10n } = props

  return (
    <div className="curses list">
      <h4>{translateP (l10n) ("cursestotalingapleft") (List (apTotal, apLeft))}</h4>
      {pipe_ (
        list,
        map (e => {
          const id = Spell.A.id (e)
          const name = Spell.A.name (e)

          const maybeValue = lookup (id) (active)

          return (
            <div key={id}>
              <Checkbox
                checked={isJust (maybeValue)}
                disabled={isNothing (maybeValue) && apLeft <= 0}
                onClick={() => change (id) (Nothing)}
                >
                {name}
              </Checkbox>
              {maybeToNullable (fmapF (maybeValue) (value => (<span>{value}</span>)))}
              <BorderButton
                label="+"
                disabled={
                  isNothing (maybeValue)
                  || apLeft <= 0
                  || apLeft - obj .get ("ic") < 0
                }
                onClick={() => change (id) (Just<"add"> ("add"))}
                />
              <BorderButton
                label="-"
                disabled={maybe (true) (lte (0)) (maybeValue)}
                onClick={() => change (id) (Just<"remove"> ("remove"))}
                />
            </div>
          )
        }),
        toArray
      )}
    </div>
  )
}
