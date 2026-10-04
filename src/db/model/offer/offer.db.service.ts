import { IOffer } from "../../../utils/common/interfaces";
import { AbstractRepository } from "../../db.service";
import { offer } from "./offer.model";

export class OfferRepository extends AbstractRepository<IOffer> {

    constructor() {
        super(offer);
    }
}