import { Module } from '@nestjs/common';
import { FusionPbxModule } from '../fusionpbx/fusionpbx.module';
import { WebphoneController } from './webphone.controller';
import { WebphoneService } from './webphone.service';

@Module({
  imports: [FusionPbxModule],
  controllers: [WebphoneController],
  providers: [WebphoneService],
})
export class WebphoneModule {}
