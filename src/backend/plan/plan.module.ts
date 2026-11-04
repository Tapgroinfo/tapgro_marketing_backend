import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Plan, PlanSchema } from '../../db/schemas/plan.schema';
import { PlanController, PublicPlanController } from './plan.controller';
import { PlanService } from './plan.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Plan.name, schema: PlanSchema }]),
  ],
  controllers: [PlanController, PublicPlanController],
  providers: [PlanService],
  exports: [PlanService],
})
export class PlanModule {}
