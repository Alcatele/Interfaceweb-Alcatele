import { Module } from '@nestjs/common';
import { FusionPbxController } from './fusionpbx.controller';
import { FusionPbxService } from './fusionpbx.service';

@Module({
  controllers: [FusionPbxController],
  providers: [FusionPbxService],
  exports: [FusionPbxService],
})
export class FusionPbxModule {}
