
import { HubSpotTask } from './hubspotUtils.ts';
import { TASK_STATUS, PRIORITY_MAP } from './constants.ts';
import { getCurrentParisTime, formatTaskDate, getParisTimeFromUTC } from './dateUtils.ts';
import { getTaskQueue, formatOwnerName } from './hubspotUtils.ts';

export class TaskProcessor {
  filterTasksByValidOwners(tasks: HubSpotTask[], validOwnerIds: Set<string>): HubSpotTask[] {
    const tasksWithAllowedOwners = tasks.filter((task: HubSpotTask) => {
      const taskOwnerId = task.properties?.hubspot_owner_id;
      
      if (!taskOwnerId) {
        console.log(`✔️ ALLOWED: Task ${task.id} has NO OWNER (unassigned)`);
        return true;
      }
      
      if (validOwnerIds.has(taskOwnerId.toString())) {
        return true;
      } else {
        console.log(`❌ DROPPED: Task ${task.id} ownerId ${taskOwnerId} not in allowed teams`);
        return false;
      }
    });

    console.log(`Filtered tasks with allowed owners: ${tasksWithAllowedOwners.length} out of ${tasks.length}`);
    return tasksWithAllowedOwners;
  }

  transformTasks(tasks: HubSpotTask[], taskContactMap: { [key: string]: string }, contacts: any, ownersMap: any): any[] {
    const currentParisTime = getCurrentParisTime();

    return tasks.map((task: HubSpotTask) => {
      const props = task.properties;

      const contactId = taskContactMap[task.id] || null;
      const contact = contactId ? contacts[contactId] : null;

      let contactName = 'No Contact';
      let contactPhone = null;
      if (contact && contact.properties) {
        const contactProps = contact.properties;
        const firstName = contactProps.firstname || '';
        const lastName = contactProps.lastname || '';
        const email = contactProps.email || '';
        const company = contactProps.company || '';
        contactPhone = contactProps.mobilephone || null;

        if (firstName && lastName) {
          contactName = `${firstName} ${lastName}`.trim();
        } else if (firstName) {
          contactName = firstName;
        } else if (lastName) {
          contactName = lastName;
        } else if (email) {
          contactName = email;
        } else if (company) {
          contactName = company;
        } else {
          contactName = `Contact ${contactId}`;
        }
      }

      let dueDate = '';
      let taskDueDate = null;
      if (props.hs_timestamp) {
        // Parse the timestamp and ensure it's in Paris timezone
        const timestampMs = parseInt(props.hs_timestamp);
        taskDueDate = getParisTimeFromUTC(timestampMs);
        dueDate = formatTaskDate(timestampMs);
        
        console.log(`Task ${task.id} - HubSpot timestamp: ${props.hs_timestamp}, Paris date: ${taskDueDate?.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}, formatted: ${dueDate}`);
      }

      const taskOwnerId = props.hubspot_owner_id;
      const owner = taskOwnerId ? ownersMap[taskOwnerId] : null;
      const ownerName = formatOwnerName(owner);

      const queueIds = props.hs_queue_membership_ids ? props.hs_queue_membership_ids.split(';') : [];
      const queue = getTaskQueue(queueIds);

      const isCompleted = props.hs_task_status === TASK_STATUS.COMPLETED;
      const status = isCompleted ? TASK_STATUS.completed : TASK_STATUS.not_started;

      return {
        id: task.id,
        title: props.hs_task_subject || 'Untitled Task',
        description: props.hs_body_preview || undefined,
        contact: contactName,
        contactId: contactId || null,
        contactPhone: contactPhone,
        status: status,
        dueDate,
        taskDueDate,
        priority: PRIORITY_MAP[props.hs_task_priority] || 'medium',
        owner: ownerName,
        hubspotId: task.id,
        queue: queue,
        queueIds: queueIds,
        isUnassigned: !taskOwnerId,
        completionDate: props.hs_task_completion_date ? new Date(parseInt(props.hs_task_completion_date)) : null
      };
    }).filter((task: any) => {
      if (task.status === TASK_STATUS.completed) {
        return true;
      }
      
      if (task.queue === 'rappels') {
        return true;
      }
      
      if (!task.taskDueDate) return false;
      const isOverdue = task.taskDueDate < currentParisTime;
      return isOverdue;
    });
  }

  sortTasks(tasks: any[]): any[] {
    return tasks.sort((a, b) => {
      if (a.status === TASK_STATUS.completed && b.status !== TASK_STATUS.completed) return 1;
      if (a.status !== TASK_STATUS.completed && b.status === TASK_STATUS.completed) return -1;
      
      if (a.status !== TASK_STATUS.completed && b.status !== TASK_STATUS.completed) {
        if (a.queue === 'new' && b.queue === 'new') {
          if (a.isUnassigned && !b.isUnassigned) return -1;
          if (!a.isUnassigned && b.isUnassigned) return 1;
        }
      }
      
      return 0;
    });
  }
}
