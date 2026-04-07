import {groupIconUrls} from '../iconRegistryHelpers.js';

const icon_modules = import.meta.glob('../../../../icon/Vanilla/*.png', {
    import: 'default',
    eager: true,
});

export default groupIconUrls(icon_modules).Vanilla || {};
