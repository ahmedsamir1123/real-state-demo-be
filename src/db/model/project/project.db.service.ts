import { IProject } from "../../../utils/common/interfaces";
import { AbstractRepository } from "../../db.service";
import { project } from "./project.model";

export class ProjectRepository extends AbstractRepository<IProject> {

    constructor() {
        super(project);
    }
}