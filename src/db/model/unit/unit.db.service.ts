import { IUnit } from "../../../utils/common/interfaces";
import { AbstractRepository } from "../../db.service";
import { unit } from "./unit.model";

export class UnitRepository extends AbstractRepository<IUnit> {
    constructor() {
        super(unit);
    }
}
