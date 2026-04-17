# Security Specification for Doutor Clima

## Data Invariants
1. Services must have a valid `clientName` and `status`.
2. Transactions must be strictly categorized as `INCOME` or `EXPENSE`.
3. Users must have a role assigned (`ADMIN` or `TECH`).
4. Techs can only modify services assigned to them.
5. Financial data is strictly for Admins.

## The Dirty Dozen Payloads
1. **Identity Spoofing**: User A attempts to update a service `techId` to themselves even if they aren't the assignee.
2. **State Shortcutting**: A Tech attempts to delete a finalized service.
3. **Privilege Escalation**: A Tech attempts to update their own `role` to `ADMIN`.
4. **Data Injection**: A user attempts to create a client with a 2MB address string.
5. **Unauthorized Financial Access**: A Tech attempts to read the `transactions` collection.
6. **Orphaned Service**: Creating a service without a valid `date`.
7. **Negative Transaction**: Attempting to set a transaction `amount` to a negative value.
8. **Setting Terminal State**: A user trying to revert a `FINISHED` service back to `PENDING`.
9. **Fake Admin**: A user trying to write to `settings/company`.
10. **ID Poisoning**: Using a 500-character string as a document ID.
11. **Client Scraper**: Unauthenticated user trying to list all clients.
12. **Future Service**: Setting a service `date` to 50 years in the future (size/range check).

## Security Assertions
- `allow read, write: if false;` by default.
- `isAdmin()` helper checks `users/$(request.auth.uid)` role.
- `isOwner(userId)` checks `auth.uid == userId`.
- `isValidService(data)` checks keys and types.
- `allow list` on `services` collection enforces `resource.data.techId == request.auth.uid` or `isAdmin()`.
