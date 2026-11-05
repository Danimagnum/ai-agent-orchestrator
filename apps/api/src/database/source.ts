import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { databaseUrl } from '../config';
import { RunEntity, StepEntity } from './entities';
import { Initial1730000000000 } from './migrations/1730000000000-Initial';
export const source = new DataSource({
  type: 'postgres', url: databaseUrl, entities: [RunEntity, StepEntity], migrations: [Initial1730000000000], synchronize: false, logging: false
});
