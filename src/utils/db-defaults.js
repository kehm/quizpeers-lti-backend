// Database default values

export const defaultMediaTypes = [
    { name: 'image/jpeg' },
    { name: 'image/png' },
    { name: 'image/gif' },
];

export const defaultAssignmentTypes = [
    { name: 'TASK_SUBMISSION', description: 'Task submission assignment' },
    { name: 'QUIZ_DEFINITE', description: 'Quiz assignment' },
    { name: 'QUIZ_RANDOM', description: 'Randomized quiz assignment' },
];

export const defaultTaskTypes = [
    { name: 'MULTIPLE_CHOICE', description: 'Multiple choice' },
    { name: 'COMBINE_TERMS', description: 'Combine terms' },
    { name: 'NAME_IMAGE', description: 'Name image' },
];

export const defaultAssignmentStatus = [
    { name: 'PUBLISHED_WITH_SOLUTION', description: 'Published with solution' },
    { name: 'PUBLISHED_NO_SOLUTION', description: 'Published without solution' },
    { name: 'FINISHED', description: 'Finished' },
    { name: 'STARTED', description: 'Started' },
    { name: 'CREATED', description: 'Created' },
];

export const defaultConsumerStatus = [
    { name: 'ACTIVE', description: 'Active' },
    { name: 'INACTIVE', description: 'Inactive' },
];

export const defaultSubmissionStatus = [
    { name: 'EVALUATED_PUBLISHED', description: 'Published' },
    { name: 'EVALUATED', description: 'Evaluated' },
    { name: 'PENDING', description: 'Pending' },
    { name: 'STARTED', description: 'Started' },
];

export const defaultTaskStatus = [
    { name: 'EVALUATED_INCLUDE', description: 'Include' },
    { name: 'EVALUATED', description: 'Evaluated' },
    { name: 'PENDING', description: 'Pending' },
];
