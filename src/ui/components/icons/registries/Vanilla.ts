import {groupIconUrls} from '../iconRegistryHelpers';

const icon_modules = import.meta.glob('../assets/Vanilla/*.png', {
    import: 'default',
    eager: true,
});

export default groupIconUrls(icon_modules).Vanilla || {};
