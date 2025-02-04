import { Nothing } from "../../../Data/Maybe";
import { fromDefault, makeLenses, Record } from "../../../Data/Record";
import { ActiveObject } from "./ActiveObject";

export interface ActiveObjectWithId extends ActiveObject {
  id: string
  index: number
}

export const ActiveObjectWithId =
  fromDefault ("ActiveObjectWithId")
              <ActiveObjectWithId> ({
                id: "",
                index: -1,
                cost: Nothing,
                sid: Nothing,
                sid2: Nothing,
                sid3: Nothing,
                tier: Nothing,
              })

export const ActiveObjectWithIdL = makeLenses (ActiveObjectWithId)

export const toActiveObjectWithId =
  (index: number) =>
  (id: string) =>
  (active: Record<ActiveObject>) =>
    ActiveObjectWithId ({
      id,
      index,
      cost: ActiveObject.A.cost (active),
      sid: ActiveObject.A.sid (active),
      sid2: ActiveObject.A.sid2 (active),
      sid3: ActiveObject.A.sid3 (active),
      tier: ActiveObject.A.tier (active),
    })

export const fromActiveObjectWithId =
  (active: Record<ActiveObjectWithId>) =>
    ActiveObject ({
      cost: ActiveObject.A.cost (active),
      sid: ActiveObject.A.sid (active),
      sid2: ActiveObject.A.sid2 (active),
      sid3: ActiveObject.A.sid3 (active),
      tier: ActiveObject.A.tier (active),
    })
