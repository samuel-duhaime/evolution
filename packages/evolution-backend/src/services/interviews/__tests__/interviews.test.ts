/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import Interviews from '../interviews';
import { InterviewAttributes } from 'evolution-common/lib/services/questionnaire/types';
import interviewsQueries from '../../../models/interviews.db.queries';
import interviewsAccessesQueries from '../../../models/interviewsAccesses.db.queries';
import { registerAccessCodeValidationFunction } from '../../accessCode';
import { updateInterview } from '../interview';
import moment from 'moment';
import { getParadataLoggingFunction } from '../../logging/paradataLogging';

jest.mock('../../../models/interviews.db.queries', () => ({
    findByResponse: jest.fn(),
    getInterviewByUuid: jest.fn(),
    create: jest.fn(),
    getUserInterview: jest.fn(),
    getList: jest.fn(),
    getValidationAuditStats: jest.fn()
}));

jest.mock('../../../models/interviewsAccesses.db.queries', () => ({
    statEditingUsers: jest.fn()
}));
const mockDbCreate = interviewsQueries.create as jest.MockedFunction<typeof interviewsQueries.create>;
const mockDbGetByUuid = interviewsQueries.getInterviewByUuid as jest.MockedFunction<typeof interviewsQueries.getInterviewByUuid>;
const mockStatEditingUsers = interviewsAccessesQueries.statEditingUsers as jest.MockedFunction<typeof interviewsAccessesQueries.statEditingUsers>;

jest.mock('../interview', () => ({
    updateInterview: jest.fn()
}));
const mockInterviewUpdate = updateInterview as jest.MockedFunction<typeof updateInterview>;

jest.mock('../../logging/paradataLogging', () => ({
    getParadataLoggingFunction: jest.fn().mockReturnValue(undefined)
}));
const mockGetParadataLogFunction = getParadataLoggingFunction as jest.MockedFunction<typeof getParadataLoggingFunction>;

// Create 10 interviews, half are active
const allInterviews = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => ({
    id,
    uuid: 'arbitrary' + id,
    participant_id: id,
    is_valid: true,
    is_active: id % 2 === 0,
    responses: { accessCode: 'notsure' },
    validations: {},
    is_completed: false,
    is_questionable: false,
    survey_id: 1
}));
const returnedInterview = allInterviews[3];
(interviewsQueries.findByResponse as any).mockResolvedValue(allInterviews);
mockDbGetByUuid.mockResolvedValue(returnedInterview as InterviewAttributes);
(interviewsQueries.getUserInterview as any).mockResolvedValue(returnedInterview);
mockDbCreate.mockImplementation(async (newObject: Partial<InterviewAttributes>, returning: string | string[] = 'id') => {
    const returnFields = typeof returning === 'string' ? [returning] : returning;
    const ret: Partial<InterviewAttributes> = {};
    returnFields.forEach((field) => ret[field] = newObject[field] || returnedInterview[field]);
    return ret;
});
(interviewsQueries.getList as any).mockResolvedValue({ interviews: allInterviews, totalCount: allInterviews.length });
(interviewsQueries.getValidationAuditStats as any).mockResolvedValue({ audits: [] });

describe('Find by access code', () => {
    const validCode = '7145328';
    registerAccessCodeValidationFunction((accessCode) => accessCode === validCode);

    beforeEach(async () => {
        (interviewsQueries.findByResponse as any).mockClear();
    });

    test('Get all users', async() => {

        const response = await Interviews.findByAccessCode(validCode);
        expect(interviewsQueries.findByResponse).toHaveBeenCalledTimes(1);
        expect(interviewsQueries.findByResponse).toHaveBeenCalledWith({ accessCode: validCode });
        expect(response.length).toBeGreaterThan(0);
    });

    test('Invalid access code', async() => {
        const response = await Interviews.findByAccessCode('not an access code');
        expect(interviewsQueries.findByResponse).toHaveBeenCalledTimes(0);
        expect(response).toEqual([]);
    });

});

describe('Get interview by interview ID', () => {
    const interviewId = uuidV4();

    beforeEach(() => {
        (interviewsQueries.getInterviewByUuid as any).mockClear();
    });

    test('Get interview', async() => {
        const interviewUserId = await Interviews.getInterviewByUuid(interviewId);
        expect(interviewsQueries.getInterviewByUuid).toHaveBeenCalledTimes(1);
        expect(interviewsQueries.getInterviewByUuid).toHaveBeenCalledWith(interviewId);
        expect(interviewUserId).toEqual(returnedInterview);
    });

    test('Interview not found', async() => {
        (interviewsQueries.getInterviewByUuid as any).mockResolvedValue(undefined);
        const interviewUserId = await Interviews.getInterviewByUuid(interviewId);
        expect(interviewsQueries.getInterviewByUuid).toHaveBeenCalledTimes(1);
        expect(interviewsQueries.getInterviewByUuid).toHaveBeenCalledWith(interviewId);
        expect(interviewUserId).toBeUndefined();
    });

    test('Invalid uuid', async() => {
        const interviewUserId = await Interviews.getInterviewByUuid('not a valid uuid');
        expect(interviewsQueries.getInterviewByUuid).not.toHaveBeenCalled();
        expect(interviewUserId).toBeUndefined();
    });

    test('Invalid data', async() => {
        const interviewUserId = await Interviews.getInterviewByUuid({ foo: 'bar' } as any);
        expect(interviewsQueries.getInterviewByUuid).not.toHaveBeenCalled();
        expect(interviewUserId).toBeUndefined();
    });

});

describe('Get interview by userId', () => {
    const userId = 1;

    beforeEach(() => {
        (interviewsQueries.getUserInterview as any).mockClear();
    });

    test('Get interview', async() => {
        const interview = await Interviews.getUserInterview(userId);
        expect(interviewsQueries.getUserInterview).toHaveBeenCalledTimes(1);
        expect(interviewsQueries.getUserInterview).toHaveBeenCalledWith(userId);
        expect(interview).toEqual(returnedInterview);
    });

    test('Interview not found', async() => {
        (interviewsQueries.getUserInterview as any).mockResolvedValue(undefined);
        const interview = await Interviews.getUserInterview(userId);
        expect(interviewsQueries.getUserInterview).toHaveBeenCalledTimes(1);
        expect(interviewsQueries.getUserInterview).toHaveBeenCalledWith(userId);
        expect(interview).toBeUndefined();
    });

    test('Exception thrown by db query', async() => {
        const error = 'Fake database error';

        (interviewsQueries.getUserInterview as any).mockRejectedValueOnce(error);
        let thrownError: any = false;
        try {
            await Interviews.getUserInterview(userId);
        } catch (err) {
            thrownError = err;
        }
        expect(thrownError).toEqual(error);
    });

});

describe('Create interviews', () => {

    const participantId = 20;
    let createdInterview: InterviewAttributes | undefined = undefined;

    beforeEach(() => {
        jest.clearAllMocks();
        mockDbCreate.mockImplementationOnce(async (interview, returning = 'uuid') => {
            const newInterview = {
                ...interview,
                uuid: interview.uuid ? interview.uuid : uuidV4()
            };
            createdInterview = newInterview as InterviewAttributes;
            const returnInterview = {};
            const returningArr = typeof returning === 'string' ? [returning] : returning;
            returningArr?.forEach((field) => returnInterview[field] = newInterview[field]);
            return returnInterview;
        });
    });

    test('Create with empty responses', async() => {

        const newInterview = await Interviews.createInterviewForUser(participantId, {});
        expect(mockDbCreate).toHaveBeenCalledTimes(1);
        expect(mockDbCreate).toHaveBeenCalledWith({
            participant_id: participantId,
            responses: { _startedAt: expect.anything() },
            is_active: true,
            validations: {}
        }, 'uuid');
        expect(newInterview).toEqual({ uuid: expect.anything() });
        expect(mockDbGetByUuid).not.toHaveBeenCalled();
        expect(mockInterviewUpdate).not.toHaveBeenCalled();
    });

    test('Create with default responses', async() => {
        mockDbGetByUuid.mockImplementationOnce(async () => createdInterview);
        const responses = {
            foo: 'bar',
            fooObj: {
                baz: 'test'
            }
        };
        const newInterview = await Interviews.createInterviewForUser(participantId, responses);
        expect(mockDbCreate).toHaveBeenCalledTimes(1);
        expect(mockDbCreate).toHaveBeenCalledWith({
            participant_id: participantId,
            responses: { ...responses, _startedAt: expect.anything() },
            is_active: true,
            validations: {}
        }, 'uuid');
        expect(newInterview).toEqual({ uuid: expect.anything() });
        expect(mockDbGetByUuid).toHaveBeenCalledTimes(1);
        expect(mockDbGetByUuid).toHaveBeenCalledWith(newInterview.uuid);
        expect(mockInterviewUpdate).toHaveBeenCalledWith(createdInterview, {
            valuesByPath: { 'responses.foo': responses.foo, 'responses.fooObj': responses.fooObj },
            fieldsToUpdate: ['responses']
        });
    });

    test('Create and return single other field', async() => {
        const userId = 1;
        const newInterview = await Interviews.createInterviewForUser(participantId, {}, userId, 'participant_id');
        expect(mockDbCreate).toHaveBeenCalledTimes(1);
        expect(mockDbCreate).toHaveBeenCalledWith({
            participant_id: participantId,
            responses: { _startedAt: expect.anything() },
            is_active: true,
            validations: {}
        }, 'participant_id');
        expect(newInterview).toEqual({ participant_id: participantId });
        expect(mockDbGetByUuid).not.toHaveBeenCalled();
        expect(mockInterviewUpdate).not.toHaveBeenCalled();
    });

    test('Create and return many other field', async() => {
        const initialTimeStamp = moment().unix();
        const returningFields = ['participant_id', 'responses', 'uuid'];
        const newInterview = await Interviews.createInterviewForUser(participantId, {}, undefined, returningFields);
        expect(mockDbCreate).toHaveBeenCalledTimes(1);
        expect(mockDbCreate).toHaveBeenCalledWith({
            participant_id: participantId,
            responses: { _startedAt: expect.anything() },
            is_active: true,
            validations: {}
        }, returningFields);
        expect(newInterview).toEqual({ participant_id: participantId, uuid: expect.anything(), responses: { _startedAt: expect.anything() } });
        expect(mockDbGetByUuid).not.toHaveBeenCalled();
        expect(mockInterviewUpdate).not.toHaveBeenCalled();

        // Make sure timestamp in response is higher than the one at the beginning of the test
        expect((newInterview.responses as any)._startedAt).toBeGreaterThanOrEqual(initialTimeStamp);
    });

    test('Create with log update', async() => {
        mockDbGetByUuid.mockImplementationOnce(async () => createdInterview);
        // Return a log function and make sure it is passed to the update
        const logFunction = jest.fn();
        const userId = 123
        mockGetParadataLogFunction.mockReturnValueOnce(logFunction);

        const newInterview = await Interviews.createInterviewForUser(participantId, { initial: 'value' }, userId);
        expect(mockDbCreate).toHaveBeenCalledTimes(1);
        expect(mockDbCreate).toHaveBeenCalledWith({
            participant_id: participantId,
            responses: { _startedAt: expect.anything(), initial: 'value' },
            is_active: true,
            validations: {}
        }, 'uuid');
        expect(newInterview).toEqual({ uuid: expect.anything() });
        expect(mockDbGetByUuid).toHaveBeenCalledTimes(1);
        expect(mockDbGetByUuid).toHaveBeenCalledWith(newInterview.uuid);
        expect(mockGetParadataLogFunction).toHaveBeenCalledTimes(1);
        expect(mockGetParadataLogFunction).toHaveBeenCalledWith(createdInterview!.id, userId);
        expect(mockInterviewUpdate).toHaveBeenCalledWith(createdInterview, {
            logUpdate: logFunction,
            valuesByPath: { 'responses.initial': 'value' },
            fieldsToUpdate: ['responses']
        });
    });

});

describe('Get all matching', () => {

    beforeEach(() => {
        (interviewsQueries.getList as any).mockClear();
    });

    test('Empty parameters', async() => {
        await Interviews.getAllMatching();
        expect(interviewsQueries.getList).toHaveBeenCalledTimes(1);
        expect(interviewsQueries.getList).toHaveBeenCalledWith({
            filters: {},
            pageIndex: 0,
            pageSize: -1
        });
    });

    test('Page index and page size', async() => {
        const pageIndex = 3;
        const pageSize = 10;
        await Interviews.getAllMatching({
            pageIndex,
            pageSize,
        });
        expect(interviewsQueries.getList).toHaveBeenCalledTimes(1);
        expect(interviewsQueries.getList).toHaveBeenCalledWith({
            filters: {},
            pageIndex,
            pageSize
        });
    });

    test('Filters: updatedAt and others', async() => {
        const updatedAt = 12300000;
        await Interviews.getAllMatching({
            updatedAt
        });
        expect(interviewsQueries.getList).toHaveBeenCalledTimes(1);
        expect(interviewsQueries.getList).toHaveBeenCalledWith({
            filters: { updated_at: { value: updatedAt, op: 'gte' } },
            pageIndex: 0,
            pageSize: -1
        });

        // Updated_at is 0, should not be sent to the query
        await Interviews.getAllMatching({
            updatedAt: 0
        });
        expect(interviewsQueries.getList).toHaveBeenCalledTimes(2);
        expect(interviewsQueries.getList).toHaveBeenLastCalledWith({
            filters: {},
            pageIndex: 0,
            pageSize: -1
        });
    });

    test('Various isValid filter values', async() => {
        const pageIndex = 3;
        const pageSize = 10;
        // isValid: valid
        await Interviews.getAllMatching({
            pageIndex,
            pageSize,
            filter: { is_valid: 'valid' }
        });
        expect(interviewsQueries.getList).toHaveBeenCalledTimes(1);
        expect(interviewsQueries.getList).toHaveBeenCalledWith({
            filters: { is_valid: { value: true, op: 'eq' } },
            pageIndex,
            pageSize
        });

        // isValid: all
        await Interviews.getAllMatching({
            pageIndex,
            pageSize,
            filter: { is_valid: 'all' }
        });
        expect(interviewsQueries.getList).toHaveBeenCalledTimes(2);
        expect(interviewsQueries.getList).toHaveBeenLastCalledWith({
            filters: { },
            pageIndex,
            pageSize
        });

        // isValid: invalid
        await Interviews.getAllMatching({
            filter: { is_valid: 'invalid' }
        });
        expect(interviewsQueries.getList).toHaveBeenCalledTimes(3);
        expect(interviewsQueries.getList).toHaveBeenLastCalledWith({
            filters: { is_valid: { value: false, op: 'eq' } },
            pageIndex: 0,
            pageSize: -1
        });

        // isValid: notValidated
        await Interviews.getAllMatching({
            filter: { is_valid: 'notValidated' }
        });
        expect(interviewsQueries.getList).toHaveBeenCalledTimes(4);
        expect(interviewsQueries.getList).toHaveBeenLastCalledWith({
            filters: { is_valid: { value: null, op: 'eq' } },
            pageIndex: 0,
            pageSize: -1
        });

        // isValid: notInvalid
        await Interviews.getAllMatching({
            filter: { is_valid: 'notInvalid' }
        });
        expect(interviewsQueries.getList).toHaveBeenCalledTimes(5);
        expect(interviewsQueries.getList).toHaveBeenLastCalledWith({
            filters: { is_valid: { value: false, op: 'not' } },
            pageIndex: 0,
            pageSize: -1
        });
    });

    test('Only page size', async() => {
        const pageSize = 10;
        // isValid: valid
        await Interviews.getAllMatching({
            pageSize,
        });
        expect(interviewsQueries.getList).toHaveBeenCalledTimes(1);
        expect(interviewsQueries.getList).toHaveBeenCalledWith({
            filters: {},
            pageIndex: 0,
            pageSize
        });
    });

    test('Only page index', async() => {
        const pageIndex = 3;
        // isValid: valid
        await Interviews.getAllMatching({
            pageIndex,
        });
        expect(interviewsQueries.getList).toHaveBeenCalledTimes(1);
        expect(interviewsQueries.getList).toHaveBeenCalledWith({
            filters: {},
            pageIndex,
            pageSize: -1
        });
    });

    test('With sort', async() => {
        const pageIndex = 3;
        // isValid: valid
        await Interviews.getAllMatching({
            pageIndex,
            sort: ['uuid']
        });
        expect(interviewsQueries.getList).toHaveBeenCalledTimes(1);
        expect(interviewsQueries.getList).toHaveBeenCalledWith({
            filters: {},
            pageIndex,
            pageSize: -1,
            sort: ['uuid']
        });
    });

    test('Filters: various filters', async() => {
        // string audit
        await Interviews.getAllMatching({
            filter: { audits: 'myAudit' }
        });
        expect(interviewsQueries.getList).toHaveBeenCalledTimes(1);
        expect(interviewsQueries.getList).toHaveBeenCalledWith({
            filters: { audits: { value: 'myAudit' } },
            pageIndex: 0,
            pageSize: -1
        });

        // array of string audit
        await Interviews.getAllMatching({
            filter: { audits: ['myAudit1', 'myAudit2'] }
        });
        expect(interviewsQueries.getList).toHaveBeenCalledTimes(2);
        expect(interviewsQueries.getList).toHaveBeenCalledWith({
            filters: { audits: { value: ['myAudit1', 'myAudit2'] } },
            pageIndex: 0,
            pageSize: -1
        });

        // object filter
        await Interviews.getAllMatching({
            filter: { audits: { value: 'myAudit', op: 'like' } }
        });
        expect(interviewsQueries.getList).toHaveBeenCalledTimes(3);
        expect(interviewsQueries.getList).toHaveBeenCalledWith({
            filters: { audits: { value: 'myAudit', op: 'like' } },
            pageIndex: 0,
            pageSize: -1
        });

    });

});

describe('Get Validation errors', () => {

    beforeEach(() => {
        (interviewsQueries.getValidationAuditStats as any).mockClear();
    });

    test('Empty parameters', async() => {
        await Interviews.getValidationAuditStats();
        expect(interviewsQueries.getValidationAuditStats).toHaveBeenCalledTimes(1);
        expect(interviewsQueries.getValidationAuditStats).toHaveBeenCalledWith({
            filters: {}
        });
    });

    test('Various isValid filter values', async() => {
        // isValid: valid
        await Interviews.getValidationAuditStats({
            filter: { is_valid: 'valid' }
        });
        expect(interviewsQueries.getValidationAuditStats).toHaveBeenCalledTimes(1);
        expect(interviewsQueries.getValidationAuditStats).toHaveBeenCalledWith({
            filters: { is_valid: { value: true, op: 'eq' } }
        });

        // isValid: all
        await Interviews.getValidationAuditStats({
            filter: { is_valid: 'all' }
        });
        expect(interviewsQueries.getValidationAuditStats).toHaveBeenCalledTimes(2);
        expect(interviewsQueries.getValidationAuditStats).toHaveBeenLastCalledWith({
            filters: { }
        });
    });

    test('Filters: various filters', async() => {
        await Interviews.getValidationAuditStats({
            filter: { test: 'foo' }
        });
        expect(interviewsQueries.getValidationAuditStats).toHaveBeenCalledTimes(1);
        expect(interviewsQueries.getValidationAuditStats).toHaveBeenCalledWith({
            filters: { test: { value: 'foo' } }
        });

        // Updated_at is 0, should not be sent to the query
        await Interviews.getValidationAuditStats({
            filter: { test: 'foo', other: { value: 'bar', op: 'gte' } }
        });
        expect(interviewsQueries.getValidationAuditStats).toHaveBeenCalledTimes(2);
        expect(interviewsQueries.getValidationAuditStats).toHaveBeenLastCalledWith({
            filters: { test: { value: 'foo' }, other: { value: 'bar', op: 'gte' } }
        });
    });
});

describe('Reset interview', () => {

    test('Test with bad confirmation parameter', async () => {
        let exception: unknown = undefined;
        try {
            await Interviews.resetInterviews('confirm');
        } catch(error) {
            exception = error;
        }
        expect(exception).toBeDefined();
    });

});

describe('Stat editing users', () => {

    beforeEach(() => {
        mockStatEditingUsers.mockClear();
    });

    test('Test with correct answer', async () => {
        const userStats = [
            { email: 'foo@bar.com', interview_id: 12, user_id: 3, for_validation: false, update_count: 10, created_at: '2023-06-28', updated_at: '2023-06-28' },
            { email: 'a@b.c', interview_id: 12, user_id: 3, for_validation: false, update_count: 2, created_at: '2023-06-28', updated_at: '2023-06-28' }
        ];
        mockStatEditingUsers.mockResolvedValueOnce(userStats);
        const stats = await Interviews.statEditingUsers();
        expect(stats).toEqual(userStats);
        expect(mockStatEditingUsers).toHaveBeenCalledWith({});
    });

    test('Test with permissions', async () => {
        const userStats = [
            { email: 'foo@bar.com', interview_id: 12, user_id: 3, for_validation: false, update_count: 10, created_at: '2023-06-28', updated_at: '2023-06-28' },
            { email: 'a@b.c', interview_id: 12, user_id: 3, for_validation: false, update_count: 2, created_at: '2023-06-28', updated_at: '2023-06-28' }
        ];
        mockStatEditingUsers.mockResolvedValueOnce(userStats);
        const stats = await Interviews.statEditingUsers({ permissions: [ 'role1', 'role2' ] });
        expect(stats).toEqual(userStats);
        expect(mockStatEditingUsers).toHaveBeenCalledWith({ permissions: [ 'role1', 'role2' ] });
    });

    test('Test with exception', async () => {
        mockStatEditingUsers.mockRejectedValueOnce('Error');
        let exception: unknown = undefined;
        try {
            await Interviews.statEditingUsers();
        } catch(error) {
            exception = error;
        }
        expect(exception).toBeDefined();
    });

});
