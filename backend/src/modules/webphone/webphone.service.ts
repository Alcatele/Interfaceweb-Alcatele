import { Injectable, NotFoundException } from '@nestjs/common';
import { SessionContext } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { FusionPbxService } from '../fusionpbx/fusionpbx.service';

@Injectable()
export class WebphoneService {
  constructor(
    private readonly database: DatabaseService,
    private readonly fusionPbxService: FusionPbxService,
  ) {}

  async getConfig(session: SessionContext) {
    const extension = await this.database.tenantTransaction(
      session.tenant.id,
      session.user.id,
      session.membershipId,
      async (client) => {
        const result = await client.query<{
          extension_number: string;
          display_name: string;
          auth_username: string;
        }>(
          `SELECT extension_number, display_name, auth_username
           FROM telephony.extensions
           WHERE tenant_id = $1
             AND membership_id = $2
             AND deleted_at IS NULL`,
          [session.tenant.id, session.membershipId],
        );
        return result.rows[0];
      },
    );

    if (!extension) {
      throw new NotFoundException('Usuário não possui ramal WebRTC.');
    }

    const credential =
      await this.fusionPbxService.issueWebphoneCredentials(
        session,
        extension.extension_number,
        extension.auth_username,
      );
    const sipDomain =
      process.env.WEBPHONE_SIP_DOMAIN ?? session.tenant.domain;

    return {
      uri: `sip:${extension.extension_number}@${sipDomain}`,
      authorizationUsername: extension.auth_username,
      password: credential.password,
      displayName: extension.display_name,
      wsServer:
        process.env.WEBPHONE_WSS_URL ?? `wss://${sipDomain}:7443`,
      sipDomain,
    };
  }
}
