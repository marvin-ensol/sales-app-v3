-- Create trigger to handle list membership automation on insert
CREATE TRIGGER on_list_membership_insert
AFTER INSERT ON hs_list_memberships
FOR EACH ROW
EXECUTE FUNCTION handle_list_membership_automation();