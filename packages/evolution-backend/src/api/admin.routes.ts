/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import moment from 'moment';
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import { Response, Request } from 'express';

import router from 'chaire-lib-backend/lib/api/admin.routes';
// Add export routes from admin/exports.routes
import { addExportRoutes } from './admin/exports.routes';

addExportRoutes();

router.all('/data/widgets/:widget/', (req: Request, res: Response, _next) => {
    const widgetName = req.params.widget;

    if (!widgetName) {
        return res.status(200).json({ status: 'provide a valid widget name' });
    }
    switch (widgetName) {
    case 'started-and-completed-interviews-by-day':
        getStartedAndCompletedInterviewsByDay(res);
        break;
    case 'started-interviews-count':
        // Get the count of started interviews
        getStartedInterviewsCount(res);
        break;
    case 'completed-interviews-count':
        getCompletedInterviewsCount(res);
        break;
    case 'interviews-completion-rate':
        getInterviewsCompletionRate(res);
        break;
    case 'median-survey-duration':
        getMedianSurveyDuration(res);
        break;
    case 'estimated-median-survey-duration':
        getEstimatedMedianSurveyDuration(res);
        break;
    case 'average-survey-interest':
        getAverageSurveyInterest(res);
        break;
    case 'average-survey-difficulty':
        getAverageSurveyDifficulty(res);
        break;
    case 'survey-duration-perception':
        getSurveyDurationPerception(res);
        break;
    case 'survey-difficulty':
        getSurveyDifficultyDistribution(res);
        break;
    case 'survey-demandingness':
        getSurveyDemandingness(res);
        break;
    default:
        return res
            .status(404)
            .json({ status: 'ERROR', message: `Admin monitoring widget '${widgetName}' not found` });
    }
});

// TODO: add CSV export for this widget:
const getStartedAndCompletedInterviewsByDay = async (res: Response) => {
    // Get the sum directly from the DB, using the started_at date for grouping
    const subquery = knex('sv_interviews').select(
        'id',
        knex.raw('to_char(created_at, \'YYYY-MM-DD\') as started_at_date'),
        knex.raw('case when response->>\'_completedAt\' is null then 0 else 1 end as is_completed')
    );
    const responses = await knex(subquery.as('resp_data'))
        .select('started_at_date')
        .count({ started_at: 'id' })
        .sum({ is_completed: 'is_completed' })
        .whereNotNull('started_at_date')
        .groupBy('started_at_date')
        .orderBy('started_at_date');
    if (responses.length <= 0) {
        return res
            .status(200)
            .json({ status: 'OK', dates: [], started: [], completed: [], startedCount: 0, completedCount: 0 });
    }

    // Create an array of dates with all dates in range
    const dates: string[] = [];
    const firstDate = moment(responses[0]['started_at_date']);
    const lastDate = moment(responses[responses.length - 1]['started_at_date']);
    for (let date = firstDate; date.diff(lastDate, 'days') <= 0; date.add(1, 'days')) {
        const dateStr = date.format('YYYY-MM-DD');
        dates.push(dateStr);
    }

    // Process database data into response field
    const dataByDate = {};
    responses.forEach((dateCount) => (dataByDate[dateCount['started_at_date']] = dateCount));

    const started = dates.map((date) => (dataByDate[date] !== undefined ? Number(dataByDate[date]['started_at']) : 0));
    const completed = dates.map((date) =>
        dataByDate[date] !== undefined ? Number(dataByDate[date]['is_completed']) : 0
    );
    const startedCount = started.reduce((cnt, startedCnt) => cnt + startedCnt, 0);
    const completedCount = completed.reduce((cnt, startedCnt) => cnt + startedCnt, 0);

    return res.status(200).json({ status: 'OK', dates, started, completed, startedCount, completedCount });
};

// Helper function to get started interviews count from database
const getStartedInterviewsCountFromDb = async () => {
    const result = await knex('sv_interviews').count({ started: 'id' });
    return result && result[0] && result[0].started ? Number(result[0].started) : 0;
};

// Helper function to get completed interviews count from database
const getCompletedInterviewsCountFromDb = async () => {
    const result = await knex('sv_interviews').sum({
        is_completed: knex.raw('case when response->>\'_completedAt\' is null then 0 else 1 end')
    });
    return result && result[0] && result[0].is_completed ? Number(result[0].is_completed) : 0;
};

// Get the count of started interviews
const getStartedInterviewsCount = async (res: Response) => {
    try {
        const startedInterviewsCount = await getStartedInterviewsCountFromDb();
        return res.status(200).json({ status: 'OK', startedInterviewsCount });
    } catch (error) {
        console.error('Error fetching started interviews count:', error);
        return res.status(500).json({ status: 'ERROR', message: 'Failed to fetch started interviews count' });
    }
};

// Get the count of completed interviews
const getCompletedInterviewsCount = async (res: Response) => {
    try {
        const completedInterviewsCount = await getCompletedInterviewsCountFromDb();
        return res.status(200).json({ status: 'OK', completedInterviewsCount });
    } catch (error) {
        console.error('Error fetching completed interviews count:', error);
        return res.status(500).json({ status: 'ERROR', message: 'Failed to fetch completed interviews count' });
    }
};

// Get the interviews completion rate (completed / started, as a percentage, rounded to 1 decimal)
const getInterviewsCompletionRate = async (res: Response) => {
    try {
        // Get counts using helper functions
        const startedCount = await getStartedInterviewsCountFromDb();
        const completedCount = await getCompletedInterviewsCountFromDb();

        // Calculate completion rate (as percentage, 0 if startedCount is 0), rounded to 1 decimal
        const completionRate = startedCount > 0 ? Number(((completedCount / startedCount) * 100).toFixed(1)) : 0;

        return res.status(200).json({ status: 'OK', interviewsCompletionRate: completionRate });
    } catch (error) {
        console.error('Error fetching interviews completion rate:', error);
        return res.status(500).json({ status: 'ERROR', message: 'Failed to fetch interviews completion rate' });
    }
};

// Get the median survey duration in minutes from completed interviews
const getMedianSurveyDuration = async (res: Response) => {
    // TODO: Implement median survey duration calculation
    return res.status(200).json({ status: 'OK', medianSurveyDuration: 0 });
};

// Get the estimated median survey duration in minutes based on survey design
const getEstimatedMedianSurveyDuration = async (res: Response) => {
    // TODO: Implement estimated median survey duration calculation
    return res.status(200).json({ status: 'OK', estimatedMedianSurveyDuration: 0 });
};

// Get the average survey interest rating from respondent feedback
const getAverageSurveyInterest = async (res: Response) => {
    // TODO: Implement average survey interest calculation
    return res.status(200).json({ status: 'OK', averageSurveyInterest: 0 });
};

// Get the average survey difficulty rating from respondent feedback
const getAverageSurveyDifficulty = async (res: Response) => {
    // TODO: Implement average survey difficulty calculation
    return res.status(200).json({ status: 'OK', averageSurveyDifficulty: 0 });
};

// Get the survey duration perception rating from respondent feedback
const getSurveyDurationPerception = async (res: Response) => {
    // TODO: Implement survey duration perception calculation
    return res.status(200).json({ status: 'OK', surveyDurationPerception: 0 });
};

// TODO: Replace the example implementation below with real data from the database
// Get the survey difficulty distribution from respondent feedback
const getSurveyDifficultyDistribution = async (res: Response) => {
    try {
        // Example distribution data
        const distribution = [
            { value: 3, valueName: '0-10 %', valueUnit: ' %' },
            { value: 8, valueName: '10-20 %', valueUnit: ' %' },
            { value: 15, valueName: '20-30 %', valueUnit: ' %' },
            { value: 25, valueName: '30-40 %', valueUnit: ' %' },
            { value: 20, valueName: '40-50 %', valueUnit: ' %' },
            { value: 18, valueName: '50-60 % ', valueUnit: ' %' },
            { value: 10, valueName: '60-70 % ', valueUnit: ' %' },
            { value: 1, valueName: '70-80 % ', valueUnit: ' %' },
            { value: 3, valueName: '80-90 % ', valueUnit: ' %' },
            { value: 8, valueName: '90-100 % ', valueUnit: ' %' }
        ];
        return res.status(200).json({ status: 'OK', data: distribution });
    } catch (error) {
        console.error('Error fetching survey difficulty distribution:', error);
        return res.status(500).json({ status: 'ERROR', message: 'Failed to fetch survey difficulty distribution' });
    }
};

// Get the survey demandingness rating from respondent feedback
const getSurveyDemandingness = async (res: Response) => {
    // TODO: Implement survey demandingness calculation
    return res.status(200).json({ status: 'OK', surveyDemandingness: 0 });
};

export default router;
