import type { Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@fkd/shared';

export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
