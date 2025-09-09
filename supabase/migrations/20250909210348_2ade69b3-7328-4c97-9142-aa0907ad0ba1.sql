-- Clear broken sync metadata to allow fresh full sync
DELETE FROM sync_metadata WHERE owner_id = 'global' AND last_sync_success = false;