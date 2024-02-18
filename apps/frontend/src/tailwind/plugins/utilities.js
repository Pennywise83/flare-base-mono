const plugin = require('tailwindcss/plugin');

module.exports = plugin(({
    addComponents,
}) =>
{
    addComponents(
        {
            '.mat-icon'       : {
                '--tw-text-opacity': '1',
                color              : 'rgba(var(--ui-mat-icon-rgb), var(--tw-text-opacity))',
            },
            '.text-default'   : {
                '--tw-text-opacity': '1 !important',
                color              : 'rgba(var(--ui-text-default-rgb), var(--tw-text-opacity)) !important',
            },
            '.text-secondary' : {
                '--tw-text-opacity': '1 !important',
                color              : 'rgba(var(--ui-text-secondary-rgb), var(--tw-text-opacity)) !important',
            },
            '.text-hint'      : {
                '--tw-text-opacity': '1 !important',
                color              : 'rgba(var(--ui-text-hint-rgb), var(--tw-text-opacity)) !important',
            },
            '.text-disabled'  : {
                '--tw-text-opacity': '1 !important',
                color              : 'rgba(var(--ui-text-disabled-rgb), var(--tw-text-opacity)) !important',
            },
            '.divider'        : {
                color: 'var(--ui-divider) !important',
            },
            '.bg-card'        : {
                '--tw-bg-opacity': '1 !important',
                backgroundColor  : 'rgba(var(--ui-bg-card-rgb), var(--tw-bg-opacity)) !important',
            },
            '.bg-default'     : {
                '--tw-bg-opacity': '1 !important',
                backgroundColor  : 'rgba(var(--ui-bg-default-rgb), var(--tw-bg-opacity)) !important',
            },
            '.bg-dialog'      : {
                '--tw-bg-opacity': '1 !important',
                backgroundColor  : 'rgba(var(--ui-bg-dialog-rgb), var(--tw-bg-opacity)) !important',
            },
            '.ring-bg-default': {
                '--tw-ring-opacity': '1 !important',
                '--tw-ring-color'  : 'rgba(var(--ui-bg-default-rgb), var(--tw-ring-opacity)) !important',
            },
            '.ring-bg-card'   : {
                '--tw-ring-opacity': '1 !important',
                '--tw-ring-color'  : 'rgba(var(--ui-bg-card-rgb), var(--tw-ring-opacity)) !important',
            },
        },
    );

    addComponents(
        {
            '.bg-hover': {
                backgroundColor: 'var(--ui-bg-hover) !important',
            },
        },
    );
});
