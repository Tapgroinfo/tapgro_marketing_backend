import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SupportTicket,
  SupportTicketSchema,
} from '../../db/schemas/supportTicket.schema';
import { Counter, CounterSchema } from '../../db/schemas/counter.schema';
import { UserSchema } from '../../db/schemas/user.schema';
import {
  PublicSupportController,
  SupportController,
} from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportTicket.name, schema: SupportTicketSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: 'User', schema: UserSchema },
    ]),
  ],
  controllers: [SupportController, PublicSupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
