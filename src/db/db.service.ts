import {
  Model,
  MongooseUpdateQueryOptions,
  ProjectionType,
  QueryFilter,
  QueryOptions,
  UpdateQuery,
} from 'mongoose';

export abstract class AbstractRepository<T extends object> {
  constructor(
    protected readonly model: Model<T>
  ) {}

  async create(item: Partial<T>) {
    return this.model.create(item);
  }

  async getOne(
    filter: QueryFilter<T>,
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>
  ) {
    return this.model.findOne(filter, projection, options).exec();
  }

  async update(
    filter: QueryFilter<T>,
    update: UpdateQuery<T>,
    options?: MongooseUpdateQueryOptions<T>
  ) {
    return this.model.findOneAndUpdate(filter, update, {
      ...options,
      new: true,
      runValidators: true,
    }).exec();
  }

  async delete(filter: QueryFilter<T>) {
    return this.model.findOneAndDelete(filter).exec();
  }
  async getAll(
    filter: QueryFilter<T> = {},
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>
  ) {
    return this.model.find(filter, projection, options).exec();
  }

  async getLatest() {
    return this.model.findOne().sort({ createdAt: -1 }).exec();
  }
}
