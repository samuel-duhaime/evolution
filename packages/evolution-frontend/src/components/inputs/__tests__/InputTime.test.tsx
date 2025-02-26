/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { interviewAttributes } from './interviewData.test';
import React from 'react';
import { render } from '@testing-library/react';

import InputTime from '../InputTime';

const userAttributes = {
    id: 1,
    username: 'foo',
    preferences: {  },
    serializedPermissions: [],
    isAuthorized: () => true,
    is_admin: false,
    pages: [],
    showUserInfo: true
}

describe('Should correctly render InputTime with minimal parameters', () => {

    const widgetConfig = {
        type: 'question' as const,
        twoColumns: true,
        path: 'test.foo',
        containsHtml: true,
        label: {
            fr: `Texte en français`,
            en: `English text`
        },
        inputType: 'time' as const
    }

    test('Test without value', () => {
        // Should have all times, at 5 minutes interval
        const { container } = render(
            <InputTime
                id={'test'}
                onValueChange={() => { /* nothing to do */}}
                widgetConfig={widgetConfig}
                value={undefined}
                inputRef={React.createRef()}
                interview={interviewAttributes}
                user={userAttributes}
                path='foo.test'
            />
        );
        expect(container).toMatchSnapshot();
    });

    test('Test with value', () => {
        // Should have all times, with the right value
        const value = 12 * 60 * 60 + 30 * 60; // 12h30
        const { container } = render(
            <InputTime
                id={'test'}
                onValueChange={() => { /* nothing to do */}}
                widgetConfig={widgetConfig}
                value={value}
                inputRef={React.createRef()}
                interview={interviewAttributes}
                user={userAttributes}
                path='foo.test'
            />
        );
        expect(container).toMatchSnapshot();
    });

});

describe('Should correctly render InputTime with various parameters', () => {

    const baseWidgetConfig = {
        type: 'question' as const,
        twoColumns: true,
        path: 'test.foo',
        containsHtml: true,
        label: {
            fr: `Texte en français`,
            en: `English text`
        },
        inputType: 'time' as const
    }

    test('Test with min max times values', () => {
        // Should times between 10 and 12.
        const widgetConfig = Object.assign({ 
            minTimeSecondsSinceMidnight: 10 * 60 * 60,
            maxTimeSecondsSinceMidnight: 12 * 60 * 60
        }, baseWidgetConfig);
        const { container } = render(
            <InputTime
                id={'test'}
                onValueChange={() => { /* nothing to do */}}
                widgetConfig={widgetConfig}
                value={undefined}
                inputRef={React.createRef()}
                interview={interviewAttributes}
                user={userAttributes}
                path='foo.test'
            />
        );
        expect(container).toMatchSnapshot();
    });

    test('Test with min max times and steps functions', () => {
        const minTimesFct = jest.fn().mockReturnValue(10 * 60 * 60);
        const maxTimesFct = jest.fn().mockReturnValue(12 * 60 * 60);
        const stepFct = jest.fn().mockReturnValue(10);
        // Should display times between 10 and 12 in 10 minutes increments
        const widgetConfig = Object.assign({ 
            minTimeSecondsSinceMidnight: minTimesFct,
            maxTimeSecondsSinceMidnight: maxTimesFct,
            minuteStep: stepFct
        }, baseWidgetConfig);
        const { container } = render(
            <InputTime
                id={'test'}
                onValueChange={() => { /* nothing to do */}}
                widgetConfig={widgetConfig}
                value={undefined}
                inputRef={React.createRef()}
                interview={interviewAttributes}
                user={userAttributes}
                path='foo.test'
            />
        );
        expect(container).toMatchSnapshot();
        expect(minTimesFct).toHaveBeenCalledTimes(1);
        expect(maxTimesFct).toHaveBeenCalledTimes(1);
        expect(stepFct).toHaveBeenCalledTimes(1);
        expect(minTimesFct).toHaveBeenCalledWith(interviewAttributes, 'foo.test', userAttributes);
        expect(maxTimesFct).toHaveBeenCalledWith(interviewAttributes, 'foo.test', userAttributes);
        expect(stepFct).toHaveBeenCalledWith(interviewAttributes, 'foo.test', userAttributes);
    });

    test('Test with suffixTimes, minutes steps and hour separator', () => {
        // Add a suffix at 10 and 13
        const suffixTimeFct = jest.fn().mockReturnValue({
            [(10 * 60 * 60).toString()]: ' 10 suffix',
            [(13 * 60 * 60).toString()]: ' 13 suffix'
        });
        // have all times, at 15 minutes interval, separator between hours and some suffixes
        const widgetConfig = Object.assign({ 
            minuteStep: 15,
            suffixTimes: suffixTimeFct,
            addHourSeparators: true
        }, baseWidgetConfig);
        const { container } = render(
            <InputTime
                id={'test'}
                onValueChange={() => { /* nothing to do */}}
                widgetConfig={widgetConfig}
                value={undefined}
                inputRef={React.createRef()}
                interview={interviewAttributes}
                user={userAttributes}
                path='foo.test'
            />
        );
        expect(container).toMatchSnapshot();
        expect(suffixTimeFct).toHaveBeenCalledTimes(1);
        expect(suffixTimeFct).toHaveBeenCalledWith(interviewAttributes, 'foo.test', userAttributes);
    });
});
