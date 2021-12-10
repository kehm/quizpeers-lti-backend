import Sequelize from 'sequelize';
import AssignmentTasks from '../models/AssignmentTasks.js';
import Submission from '../models/Submission.js';
import Task from '../models/Task.js';
import TaskGroupTasks from '../models/TaskGroupTasks.js';

/**
 * Shuffle array
 *
 * @param {Array} array Array
 */
export const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
};

/**
 * Select tasks by difficulty level
 *
 * @param {Array} size Number of tasks from each level
 * @param {Array} low Tasks with low difficulty
 * @param {Array} medium Tasks with medium difficulty
 * @param {Array} high Tasks with high difficulty
 * @param {string} userId User ID
 * @returns {Array} Tasks
 */
const selectByDifficulty = (size, low, medium, high, userId) => {
    const selectedLow = [];
    const selectedMedium = [];
    const selectedHigh = [];
    while (selectedLow.length !== size[0]) {
        let task = low.find(
            (element) => element.createdBy !== userId
                && !selectedLow.find((el) => el.task.id === element.task.id),
        );
        if (!task) {
            task = low.find(
                (element) => !selectedLow.find((el) => el.task.id === element.task.id),
            );
        }
        selectedLow.push(task);
    }
    while (selectedMedium.length !== size[1]) {
        let task = medium.find(
            (element) => element.createdBy !== userId
                && !selectedMedium.find((el) => el.task.id === element.task.id),
        );
        if (!task) {
            task = medium.find(
                (element) => !selectedMedium.find((el) => el.task.id === element.task.id),
            );
        }
        selectedMedium.push(task);
    }
    while (selectedHigh.length !== size[2]) {
        let task = high.find(
            (element) => element.createdBy !== userId
                && !selectedHigh.find((el) => el.task.id === element.task.id),
        );
        if (!task) {
            task = high.find(
                (element) => !selectedHigh.find((el) => el.task.id === element.task.id),
            );
        }
        selectedHigh.push(task);
    }
    return selectedLow.concat(selectedMedium, selectedHigh);
};

/**
 * Select tasks by group and difficulty
 *
 * @param {Array} size Number of tasks from each level
 * @param {Array} low Tasks with low difficulty
 * @param {Array} medium Tasks with medium difficulty
 * @param {Array} high Tasks with high difficulty
 * @param {string} userId User ID
 * @returns {Array} Tasks
 */
const selectByGroup = (size, low, medium, high, userId) => {
    let selected = [];
    Object.entries(size).forEach(([groupId, groupSize]) => {
        const groupSelection = selectByDifficulty(
            groupSize,
            low.filter((task) => `${task.group}` === `${groupId}`),
            medium.filter((task) => `${task.group}` === `${groupId}`),
            high.filter((task) => `${task.group}` === `${groupId}`),
            userId,
        );
        selected = selected.concat(groupSelection);
    });
    return selected;
};

/**
 * Randomly select a set of tasks for the user (exclude tasks created by the user in session)
 *
 * @param {Object} assignment Assignment
 * @param {string} userId User ID
 * @param {Array} tasks All tasks in the assignment
 */
export const getRandomTasks = (assignment, userId, tasks) => {
    const low = tasks.filter((task) => task.difficulty === 1);
    const medium = tasks.filter((task) => task.difficulty === 2);
    const high = tasks.filter((task) => task.difficulty === 3);
    shuffleArray(low);
    shuffleArray(medium);
    shuffleArray(high);
    let selected = [];
    if (Array.isArray(assignment.size)) {
        selected = selectByDifficulty(assignment.size, low, medium, high, userId);
    } else selected = selectByGroup(assignment.size, low, medium, high, userId);
    shuffleArray(selected);
    return selected;
};

/**
 * Organize terms in two arrays
 *
 * @param {Array} options Options array
 * @param {Array} solution Solution array
 * @returns {Array} Updated options array
 */
export const organizeTerms = (options, solution) => {
    const left = [];
    const right = [];
    solution.forEach((arr) => {
        left.push(options.find((option) => option.id === arr[0]));
        right.push(options.find((option) => option.id === arr[1]));
    });
    return [left, right];
};

/**
 * Get tasks in the quiz assignment
 *
 * @param {int} assignmentId Assignment ID
 * @returns {Array} Assignment tasks
 */
export const getAssignmentTasks = async (assignmentId) => {
    let tasks = await AssignmentTasks.findAll({
        where: {
            assignmentId,
        },
        attributes: ['difficulty', 'fraction'],
        include: [
            {
                model: Task,
                attributes: ['id', 'title', 'description', 'media_id', 'type', 'options', 'solution', 'edit'],
                required: true,
                include: [
                    {
                        model: Submission,
                        attributes: ['id', 'userId'],
                        required: true,
                    },
                    {
                        model: TaskGroupTasks,
                        attributes: ['task_group_id'],
                        required: false,
                    },
                ],
            },
        ],
    });
    tasks = tasks.map((assignmentTask) => {
        let task = assignmentTask.task.get({ raw: true });
        if (task.edit) {
            task = task.edit;
            if (task.mediaId) task.media_id = task.mediaId;
        }
        if (assignmentTask.task.type === 'COMBINE_TERMS') {
            task.options = organizeTerms(task.options, task.solution);
        }
        task = {
            id: assignmentTask.task.id,
            type: assignmentTask.task.type,
            title: task.title,
            description: task.description,
            media_id: task.media_id,
            options: task.options,
        };
        let group = null;
        if (assignmentTask.task.task_group_task) {
            group = assignmentTask.task.task_group_task.get({ raw: true }).task_group_id;
        }
        return {
            createdBy: assignmentTask.task.submission.get({ raw: true }).userId,
            difficulty: assignmentTask.difficulty,
            fraction: assignmentTask.fraction,
            group,
            task,
        };
    });
    return tasks;
};

/**
 * Summarize difficulty
 *
 * @param {Array} arr Array
 * @returns {int} Summarized difficulty
 */
const getDifficultySum = (arr) => {
    let difficulty = 0;
    for (let i = 0; i < arr[0]; i += 1) {
        difficulty += 1;
    }
    for (let i = 0; i < arr[1]; i += 1) {
        difficulty += 2;
    }
    for (let i = 0; i < arr[2]; i += 1) {
        difficulty += 3;
    }
    return difficulty;
};

/**
 * Get quiz total difficulty
 *
 * @param {Object} body Request body
 * @param {Object} size Size object
 * @returns {int} Summarized difficulty
 */
export const getQuizDifficulty = (body, size) => {
    let difficulty = 0;
    if (body.type === 'RANDOM') {
        if (Array.isArray(size) && size.length === 3) {
            difficulty = getDifficultySum(size);
        } else if (body.weight) {
            difficulty = {};
            Object.entries(size).forEach(([groupId, groupSize]) => {
                difficulty[groupId] = 0;
                if (Array.isArray(groupSize) && groupSize.length === 3) {
                    difficulty[groupId] += getDifficultySum(groupSize);
                }
            });
        } else {
            Object.values(size).forEach((element) => {
                if (Array.isArray(element) && element.length === 3) {
                    difficulty += getDifficultySum(element);
                }
            });
        }
    } else body.difficulties.forEach((element) => { difficulty += element; });
    return difficulty;
};

/**
 * Calculate quiz score
 *
 * @param {Object} submission Submission object
 */
export const calculateQuizScore = async (submission) => {
    const assignmentTasks = await AssignmentTasks.findAll({
        where: {
            assignmentId: submission.assignmentId,
            taskId: { [Sequelize.Op.in]: submission.tasks.map((task) => task.task.id) },
        },
        include: {
            model: Task,
            required: true,
        },
    });
    let score = 0;
    const tasks = [...submission.tasks];
    tasks.forEach((task) => {
        if (task.answer !== undefined && task.answer !== null) {
            const assignmentTask = assignmentTasks.find((el) => el.taskId === task.task.id);
            if (assignmentTask && assignmentTask.task) {
                const solution = assignmentTask.task.edit
                    ? assignmentTask.task.edit.solution
                    : assignmentTask.task.solution;
                let taskScore = 0;
                if (assignmentTask.task.type === 'MULTIPLE_CHOICE' || assignmentTask.task.type === 'NAME_IMAGE') {
                    if (task.answer === solution) {
                        taskScore = assignmentTask.fraction;
                    }
                } else if (assignmentTask.task.type === 'COMBINE_TERMS') {
                    const termFraction = assignmentTask.fraction / solution.length;
                    task.answer.forEach((answer) => {
                        if (solution.find((arr) => arr.every((el, i) => el === answer[i]))) {
                            taskScore += termFraction;
                        }
                    });
                }
                score += taskScore;
                task.score = taskScore;
            } else throw new Error('Could not find a task associated to the answer');
        }
    });
    let lmsScore = (submission['assignment.points'] / 100) * score;
    lmsScore = Math.round(lmsScore * 100) / 100;
    return { score, lmsScore, tasks };
};
