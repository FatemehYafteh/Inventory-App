import mongoose from 'mongoose';

/**
 * Makes each model's indexes in the database match its schema: creates the missing ones and
 * drops the ones the schema no longer defines (Mongoose only ever creates). For example, the
 * single-field product indexes replaced by compound ones in PR #96.
 * Returns { [modelName]: [dropped index names] }.
 */
export async function syncAllIndexes(models = Object.values(mongoose.models)) {
  const dropped = {};
  for (const model of models) {
    dropped[model.modelName] = await model.syncIndexes();
  }
  return dropped;
}
