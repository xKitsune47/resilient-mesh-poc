import { useEffect } from 'react';
import { AppState } from 'react-native';

import { MeshService } from '../services/mesh/MeshService';
import { useIdentityStore } from '../store/identityStore';
import { usePermissionStore } from '../store/permissionStore';

/**
 * Starts the mesh once permissions are granted and a nick exists; stops it if permissions
 * get revoked (the user can do that from system settings while the app is running).
 */
export function useMeshLifecycle() {
  const granted = usePermissionStore((s) => s.granted);
  const check = usePermissionStore((s) => s.check);
  const nick = useIdentityStore((s) => s.nick);

  useEffect(() => {
    if (granted && nick) {
      MeshService.start().catch((e) => console.error('Mesh start failed', e));
    } else if (MeshService.isStarted) {
      void MeshService.stop();
    }
  }, [granted, nick]);

  // Re-verify permissions whenever the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);
}
